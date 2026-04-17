from flask import Blueprint, request, jsonify, session
from api.auth import login_required, customer_required
from database.db_manager import get_conn
import json

loans_bp = Blueprint('loans', __name__)

def _domain():
    return session.get('domain', 'banking')

def _user_id():
    return session.get('user_id')

def _dept():
    return session.get('department')

def _role():
    return session.get('role')

def create_notification(conn, user_id, dept, msg, n_type, ref_id):
    conn.execute("""
        INSERT INTO notifications (user_id, department, message, type, reference_id)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, dept, msg, n_type, ref_id))

# ─── Banking Dashboard Stats ────────────────────────────────────────────────
@loans_bp.route('/api/banking/dashboard-stats', methods=['GET'])
@login_required
def banking_dashboard_stats():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        stats = {}
        cur.execute("SELECT COUNT(*) FROM Bank_Accounts WHERE account_status = 'active'")
        stats['active_accounts'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Bank_Loans_Advanced WHERE loan_status IN ('pending','under_review')")
        stats['pending_loans'] = cur.fetchone()[0]
        cur.execute("SELECT SUM(principal_amount) FROM Bank_Loans_Advanced WHERE loan_status = 'disbursed'")
        r = cur.fetchone()[0]; stats['total_disbursed'] = round(r, 2) if r else 0.0
        cur.execute("SELECT COUNT(*) FROM Bank_Transactions_Detail WHERE fraud_score > 75")
        stats['flagged_tx'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Bank_Credit_Cards_Master WHERE card_status = 'active'")
        stats['active_cards'] = cur.fetchone()[0]
        cur.execute("SELECT SUM(balance_available) FROM Bank_Accounts WHERE account_status = 'active'")
        r = cur.fetchone()[0]; stats['total_deposits'] = round(r, 2) if r else 0.0
        # Loan status breakdown
        cur.execute("SELECT loan_status, COUNT(*) FROM Bank_Loans_Advanced GROUP BY loan_status")
        stats['loan_statuses'] = {row[0]: row[1] for row in cur.fetchall()}
        return jsonify({'stats': stats})
    finally:
        conn.close()

@loans_bp.route('/api/loans/apply', methods=['POST'])
@customer_required
def apply_loan():
    data = request.get_json() or {}
    customer_id = session.get('customer_id')
    amount = data.get('amount')
    term = data.get('term', 12)
    purpose = data.get('purpose', 'Personal Loan')

    if not amount:
        return jsonify({'error': 'Amount is required'}), 400

    conn = get_conn(_domain())
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO Bank_Loans_Advanced (user_id, principal_amount, amortization_period_months, loan_product_type, loan_status, total_paid_to_date)
            VALUES (?, ?, ?, ?, 'pending_op', 0.0)
        """, (customer_id, amount, term, purpose))
        app_id = cur.lastrowid
        
        # Notify Operations staff
        create_notification(conn, None, 'operations', 
                          f"New Advanced Loan App #{app_id} for ${amount:,.2f}", 
                          'loan_app', app_id)
        
        conn.commit()
        return jsonify({'success': True, 'application_id': app_id, 'message': 'Loan application submitted and is awaiting Operations review.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@loans_bp.route('/api/loans/pending', methods=['GET'])
@login_required
def get_pending_loans():
    dept = _dept()
    role = _role()
    domain = _domain()
    
    target_status = None
    if dept == 'operations' or role == 'admin':
        target_status = 'pending_op'
    elif dept == 'finance':
        target_status = 'pending_finance'
    
    if not target_status and role != 'admin':
        return jsonify({'applications': []})

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        # Map fields back to what the frontend expects (id, amount, term_months, purpose, status)
        query = """
            SELECT l.loan_id as id, l.user_id as customer_id, l.principal_amount as amount, 
                   l.amortization_period_months as term_months, l.loan_product_type as purpose, 
                   l.loan_status as status, l.credit_score_on_approval,
                   c.name as customer_name, c.email as customer_email,
                   '' as op_comment, '' as finance_comment
            FROM Bank_Loans_Advanced l
            JOIN customers c ON l.user_id = c.id
        """
        if role != 'admin':
            query += f" WHERE l.loan_status = '{target_status}'"
        else:
            query += " ORDER BY l.loan_id DESC"
            
        cur.execute(query)
        apps = [dict(r) for r in cur.fetchall()]
        return jsonify({'applications': apps})
    finally:
        conn.close()

@loans_bp.route('/api/loans/review', methods=['POST'])
@login_required
def review_loan():
    data = request.get_json() or {}
    app_id = data.get('id')
    action = data.get('action') # 'approve' or 'reject'
    comment = data.get('comment', '')
    
    if not app_id or not action:
        return jsonify({'error': 'ID and action are required'}), 400

    dept = _dept()
    role = _role()
    domain = _domain()

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        # Need to query from Bank_Loans_Advanced mapping to expected properties
        cur.execute("""
            SELECT loan_id as id, user_id as customer_id, principal_amount as amount, loan_status as status 
            FROM Bank_Loans_Advanced 
            WHERE loan_id = ?
        """, (app_id,))
        loan = cur.fetchone()
        if not loan:
            return jsonify({'error': 'Application not found'}), 404
        
        loan = dict(loan)
        new_status = loan['status']
        
        if dept == 'operations' or role == 'admin':
            if loan['status'] != 'pending_op':
                return jsonify({'error': 'Application not in Operations review stage'}), 400
            
            if action == 'approve':
                new_status = 'pending_finance'
                # Notify Finance
                create_notification(conn, None, 'finance', 
                                  f"Loan #{app_id} approved by Operations. Awaiting Finance review.", 
                                  'loan_app', app_id)
            else:
                new_status = 'rejected_op'
                
            cur.execute("""
                UPDATE Bank_Loans_Advanced 
                SET loan_status = ?
                WHERE loan_id = ?
            """, (new_status, app_id))
            
            # Log decision to decisions table to replicate comments functionality
            cur.execute("""
                INSERT INTO decisions (domain, department, title, context, chosen_option, outcome)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (domain, 'operations', f"Loan #{app_id} Review", comment, action, new_status))
            
        elif dept == 'finance' or role == 'admin':
            if loan['status'] != 'pending_finance' and role != 'admin':
                return jsonify({'error': 'Application not in Finance review stage'}), 400
            
            if action == 'approve':
                new_status = 'approved'
                # Automate workflow: Generate a transaction and update account balance if we find one.
                cur.execute("SELECT acc_id FROM Bank_Accounts WHERE user_id = ? LIMIT 1", (loan['customer_id'],))
                acc = cur.fetchone()
                if acc:
                    # Record the transaction
                    cur.execute("""
                        INSERT INTO Bank_Transactions_Detail (to_account_id, amount_original_curr, trans_category, trans_status, description_text)
                        VALUES (?, ?, 'loan_disbursement', 'completed', ?)
                    """, (acc['acc_id'], loan['amount'], f"Loan disbursement for Loan #{app_id}"))
                    # Credit the account
                    cur.execute("""
                        UPDATE Bank_Accounts 
                        SET balance_available = ifnull(balance_available, 0) + ?, 
                            balance_ledger = ifnull(balance_ledger, 0) + ? 
                        WHERE acc_id = ?
                    """, (loan['amount'], loan['amount'], acc['acc_id']))
                else:
                    # Instead of failing, we create an account automatically for the loan disbursement
                    cur.execute("""
                        INSERT INTO Bank_Accounts (user_id, account_type, account_status, balance_ledger, balance_available)
                        VALUES (?, 'Loan Disbursement Checking', 'active', ?, ?)
                    """, (loan['customer_id'], loan['amount'], loan['amount']))
                    new_acc_id = cur.lastrowid
                    cur.execute("""
                        INSERT INTO Bank_Transactions_Detail (to_account_id, amount_original_curr, trans_category, trans_status, description_text)
                        VALUES (?, ?, 'loan_disbursement', 'completed', ?)
                    """, (new_acc_id, loan['amount'], f"Loan disbursement for Loan #{app_id}"))

                # Set credit score based on arbitrary data since we don't have a credit engine connected
                cur.execute("""
                    UPDATE Bank_Loans_Advanced 
                    SET loan_status = ?, credit_score_on_approval = ?
                    WHERE loan_id = ?
                """, (new_status, 750, app_id))

            else:
                new_status = 'rejected_finance'
                cur.execute("UPDATE Bank_Loans_Advanced SET loan_status = ? WHERE loan_id = ?", (new_status, app_id))
                
            # Log decision
            cur.execute("""
                INSERT INTO decisions (domain, department, title, context, chosen_option, outcome)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (domain, 'finance', f"Loan #{app_id} Review", comment, action, new_status))
        
        else:
            return jsonify({'error': 'Unauthorized department'}), 403

        conn.commit()
        return jsonify({'success': True, 'new_status': new_status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@loans_bp.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    domain = _domain()
    dept = _dept()
    role = _role()
    user_id = _user_id()
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        # Get notifications for this user OR their department
        cur.execute("""
            SELECT * FROM notifications 
            WHERE (user_id = ? OR department = ? OR (department IS NULL AND ? = 'admin'))
            AND is_read = 0
            ORDER BY created_at DESC
        """, (user_id, dept, role))
        notifs = [dict(r) for r in cur.fetchall()]
        return jsonify({'notifications': notifs})
    finally:
        conn.close()

@loans_bp.route('/api/notifications/read', methods=['POST'])
@login_required
def mark_read():
    data = request.get_json() or {}
    notif_id = data.get('id')
    domain = _domain()
    
    conn = get_conn(domain)
    try:
        if notif_id:
            conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        else:
            # Mark all as read for user/dept
            dept = _dept()
            user_id = _user_id()
            conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ? OR department = ?", (user_id, dept))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()
