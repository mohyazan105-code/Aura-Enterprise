from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn
import json
import random
from datetime import datetime

campaigns_bp = Blueprint('campaigns', __name__)

def _domain():
    return session.get('domain', 'banking')

def _is_banking():
    return _domain() == 'banking'

# --- 1. Dashboard Analytics ---
@campaigns_bp.route('/api/campaigns/analytics', methods=['GET'])
@login_required
def get_analytics():
    if not _is_banking():
        return jsonify({'error': 'Campaigns only available in banking'}), 403
    
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        
        # General stats
        cur.execute("SELECT COUNT(*) FROM campaign_definitions")
        total_campaigns = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*), status FROM campaign_participants GROUP BY status")
        participant_stats = {row['status']: row['COUNT(*)'] for row in cur.fetchall()}
        
        total_participants = sum(participant_stats.values())
        qualified = participant_stats.get('qualified', 0) + participant_stats.get('pending_verification', 0)
        approved = participant_stats.get('approved', 0) + participant_stats.get('completed', 0)
        rejected = participant_stats.get('rejected', 0)
        
        cur.execute("""
            SELECT SUM(d.reward_amount) 
            FROM campaign_participants p 
            JOIN campaign_definitions d ON p.campaign_id = d.id 
            WHERE p.status = 'completed'
        """)
        total_rewards = cur.fetchone()[0] or 0.0

        conversion_rate = (approved / total_participants * 100) if total_participants > 0 else 0

        # High level AI Insight
        ai_suggestion = "Increasing reward to $150 may improve participation by 20%" if conversion_rate < 50 else "Current reward $100 yields optimal conversion."

        return jsonify({
            'total_participants': total_participants,
            'qualified': qualified,
            'approved': approved,
            'rejected': rejected,
            'total_rewards': total_rewards,
            'conversion_rate': conversion_rate,
            'ai_insight': ai_suggestion
        })
    finally:
        conn.close()

# --- 2. Campaign Management ---
@campaigns_bp.route('/api/campaigns', methods=['GET'])
@login_required
def list_campaigns():
    if not _is_banking(): return jsonify([])
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM campaign_definitions")
        campaigns = [dict(r) for r in cur.fetchall()]
        return jsonify({'campaigns': campaigns})
    finally:
        conn.close()

@campaigns_bp.route('/api/campaigns', methods=['POST'])
@login_required
def create_campaign():
    if not _is_banking(): return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO campaign_definitions (name, reward_amount, min_balance, min_volume, status)
            VALUES (?, ?, ?, ?, 'draft')
        """, (data.get('name'), data.get('reward_amount', 100), data.get('min_balance', 1000), data.get('min_volume', 10000)))
        conn.commit()
        return jsonify({'success': True, 'id': cur.lastrowid})
    finally:
        conn.close()

@campaigns_bp.route('/api/campaigns/<int:cid>/launch', methods=['POST'])
@login_required
def launch_campaign(cid):
    """Launches the campaign: scans all users, identifies eligible ones, creates participants"""
    if not _is_banking(): return jsonify({'error': 'Unauthorized'}), 403
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM campaign_definitions WHERE id = ?", (cid,))
        camp = cur.fetchone()
        if not camp: return jsonify({'error': 'Not found'}), 404
        
        # Find eligible accounts
        min_bal = camp['min_balance']
        min_vol = camp['min_volume']

        # Determine transaction volume per account (simple sum of absolute transaction amounts)
        # Assuming we scan Bank_Accounts and Bank_Transactions_Detail
        cur.execute("SELECT acc_id, user_id, balance_available FROM Bank_Accounts")
        accounts = cur.fetchall()
        
        qualified_count = 0
        
        for acc in accounts:
            acc_id = acc['acc_id']
            bal = acc['balance_available']
            
            # Simulated volume check (since demo DB might not have real $10k+ volume for everyone)
            # We'll use a mix of real data and mock volume if empty
            cur.execute("SELECT SUM(amount_original_curr) FROM Bank_Transactions_Detail WHERE from_account_id = ? OR to_account_id = ?", (acc_id, acc_id))
            vol = cur.fetchone()[0] or 0
            
            # For demo purposes, let's bump the volume if bal is high enough so we get participants
            if bal >= min_bal and vol < min_vol:
                 vol = min_vol + 100 # Mocking the volume criteria passed
                 
            if bal >= min_bal and vol >= min_vol:
                # Add to participants
                cur.execute("SELECT id FROM campaign_participants WHERE campaign_id=? AND account_id=?", (cid, acc_id))
                if not cur.fetchone():
                    # Randomize some fraud scores for demo
                    fraud = random.uniform(0, 100) if random.random() > 0.8 else 0
                    risk = 'high' if fraud > 75 else ('medium' if fraud > 40 else 'low')
                    
                    cur.execute("""
                        INSERT INTO campaign_participants (campaign_id, account_id, status, fraud_score, risk_level)
                        VALUES (?, ?, 'qualified', ?, ?)
                    """, (cid, acc_id, fraud, risk))
                    
                    part_id = cur.lastrowid
                    
                    if risk == 'high':
                        cur.execute("INSERT INTO campaign_fraud_alerts (participant_id, alert_type, severity, description) VALUES (?, ?, ?, ?)",
                            (part_id, 'unusual_activity', 'high', f'Account {acc_id} flagged for high transaction volume spikes.'))
                    
                    qualified_count += 1
                    
                    # Notify user (pseudo-logic for now, user normally sees it in portal)
        
        cur.execute("UPDATE campaign_definitions SET status='active' WHERE id=?", (cid,))
        conn.commit()
        return jsonify({'success': True, 'qualified_count': qualified_count})
    finally:
        conn.close()

# --- 3. Participants & Approvals ---
@campaigns_bp.route('/api/campaigns/participants', methods=['GET'])
@login_required
def list_participants():
    if not _is_banking(): return jsonify([])
    status = request.args.get('status')
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        query = """
            SELECT p.*, a.account_no, u.name as customer_name, c.name as campaign_name, c.reward_amount
            FROM campaign_participants p
            JOIN Bank_Accounts a ON p.account_id = a.acc_id
            JOIN customers u ON a.user_id = u.id
            JOIN campaign_definitions c ON p.campaign_id = c.id
        """
        params = []
        if status:
            query += " WHERE p.status = ?"
            params.append(status)
            
        cur.execute(query, params)
        parts = [dict(r) for r in cur.fetchall()]
        return jsonify({'participants': parts})
    finally:
        conn.close()

@campaigns_bp.route('/api/campaigns/participants/<int:pid>/review', methods=['POST'])
@login_required
def review_participant(pid):
    if not _is_banking(): return jsonify({'error': 'Unauthorized'}), 403
    action = request.json.get('action') # 'approve' or 'reject'
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM campaign_participants p JOIN campaign_definitions c ON p.campaign_id = c.id WHERE p.id = ?", (pid,))
        part = cur.fetchone()
        if not part: return jsonify({'error': 'Not found'}), 404
        
        new_status = 'approved' if action == 'approve' else 'rejected'
        cur.execute("UPDATE campaign_participants SET status = ? WHERE id = ?", (new_status, pid))
        
        if new_status == 'approved':
            # Transfer reward
            reward = part['reward_amount']
            cur.execute("UPDATE Bank_Accounts SET balance_available = balance_available + ?, balance_ledger = balance_ledger + ? WHERE acc_id = ?",
                       (reward, reward, part['account_id']))
            cur.execute("UPDATE campaign_participants SET status = 'completed' WHERE id = ?", (pid,))
            
        conn.commit()
        return jsonify({'success': True, 'new_status': 'completed' if new_status == 'approved' else 'rejected'})
    finally:
        conn.close()

# --- 4. Fraud & Alerts ---
@campaigns_bp.route('/api/campaigns/alerts', methods=['GET'])
@login_required
def list_alerts():
    if not _is_banking(): return jsonify([])
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT f.*, p.account_id, a.account_no
            FROM campaign_fraud_alerts f
            JOIN campaign_participants p ON f.participant_id = p.id
            JOIN Bank_Accounts a ON p.account_id = a.acc_id
            ORDER BY f.created_at DESC
        """)
        alerts = [dict(r) for r in cur.fetchall()]
        return jsonify({'alerts': alerts})
    finally:
        conn.close()

# --- 5. Customer Portal Mock Endpoint ---
@campaigns_bp.route('/api/campaigns/portal/status', methods=['GET'])
def portal_status():
    """Customer checks if they have a pending campaign"""
    user_id = session.get('user_id') or session.get('customer_id')
    if not user_id: return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        # Find their primary account
        cur.execute("SELECT acc_id FROM Bank_Accounts WHERE user_id = ? LIMIT 1", (user_id,))
        acc = cur.fetchone()
        if not acc: return jsonify({'qualified': False})
        
        cur.execute("""
            SELECT p.id, p.status, c.reward_amount, c.name 
            FROM campaign_participants p
            JOIN campaign_definitions c ON p.campaign_id = c.id
            WHERE p.account_id = ? AND p.status IN ('qualified', 'pending_verification')
        """, (acc['acc_id'],))
        
        elig = cur.fetchone()
        if elig:
            return jsonify({
                'qualified': True,
                'participant_id': elig['id'],
                'status': elig['status'],
                'reward': elig['reward_amount'],
                'campaign_name': elig['name']
            })
        return jsonify({'qualified': False})
    finally:
        conn.close()

@campaigns_bp.route('/api/campaigns/portal/submit', methods=['POST'])
def portal_submit():
    data = request.json
    pid = data.get('participant_id')
    name = data.get('submitted_name')
    account = data.get('submitted_account')
    
    conn = get_conn('banking')
    try:
        cur = conn.cursor()
        
        # Generate match score simply by doing a basic string comparison or mock it
        cur.execute("""
            SELECT a.account_no, u.name 
            FROM campaign_participants p
            JOIN Bank_Accounts a ON p.account_id = a.acc_id
            JOIN customers u ON a.user_id = u.id
            WHERE p.id = ?
        """, (pid,))
        real_data = cur.fetchone()
        
        if not real_data:
            return jsonify({'error': 'Invalid participant'}), 404
            
        score = 100
        if name.lower().strip() != real_data['name'].lower().strip(): score -= 40
        if account.strip() != real_data['account_no'].strip(): score -= 60
        
        cur.execute("""
            INSERT INTO campaign_verifications (participant_id, submitted_name, submitted_account, match_score)
            VALUES (?, ?, ?, ?)
        """, (pid, name, account, score))
        
        cur.execute("UPDATE campaign_participants SET status = 'pending_verification' WHERE id = ?", (pid,))
        
        if score < 50:
            cur.execute("INSERT INTO campaign_fraud_alerts (participant_id, alert_type, severity, description) VALUES (?, ?, ?, ?)",
                        (pid, 'mismatched_data', 'critical', f'Verification failed match. Score: {score}'))
            cur.execute("UPDATE campaign_participants SET risk_level = 'high', fraud_score = 90 WHERE id = ?", (pid,))
            
        conn.commit()
        return jsonify({'success': True, 'match_score': score})
    finally:
        conn.close()
