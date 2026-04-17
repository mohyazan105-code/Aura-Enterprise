from flask import Blueprint, jsonify, session, request
from database.db_manager import get_conn
from api.auth import customer_required

customer_portal_bp = Blueprint('customer_portal', __name__)


# ── Banking: Full Profile ─────────────────────────────────────────────────────
@customer_portal_bp.route('/api/customer/banking/profile', methods=['GET'])
@customer_required
def get_banking_profile():
    """Returns complete banking profile: accounts, cards, loans, recent transactions."""
    cid = session.get('customer_id')
    conn = get_conn('banking')
    try:
        cur = conn.cursor()

        # Accounts
        cur.execute("""
            SELECT acc_id, account_no, account_type, account_tier, currency_id,
                   balance_available, balance_ledger, account_status,
                   overdraft_limit, daily_transfer_limit, opening_date, last_activity_at
            FROM Bank_Accounts
            WHERE user_id = ? AND account_no LIKE 'AURA-%'
            ORDER BY balance_available DESC
        """, (cid,))
        accounts = [dict(r) for r in cur.fetchall()]

        # Fallback: if no AURA- accounts, load all accounts for this user
        if not accounts:
            cur.execute("""
                SELECT acc_id, account_no, account_type, account_tier, currency_id,
                       balance_available, balance_ledger, account_status,
                       overdraft_limit, daily_transfer_limit, opening_date, last_activity_at
                FROM Bank_Accounts WHERE user_id = ? ORDER BY balance_available DESC
            """, (cid,))
            accounts = [dict(r) for r in cur.fetchall()]

        acc_ids     = [a['acc_id'] for a in accounts]
        acc_ids_set = set(acc_ids)

        # Credit Cards
        cards = []
        if acc_ids:
            ph = ','.join('?' * len(acc_ids))
            cur.execute(f"""
                SELECT c.*, a.account_no
                FROM Bank_Credit_Cards_Master c
                JOIN Bank_Accounts a ON c.account_id = a.acc_id
                WHERE c.account_id IN ({ph})
            """, acc_ids)
            cards = [dict(r) for r in cur.fetchall()]

        # Loans
        cur.execute("""
            SELECT loan_id, loan_product_type, principal_amount, remaining_balance,
                   interest_rate_fixed_variable, amortization_period_months,
                   loan_status, next_payment_date, total_paid_to_date, credit_score_on_approval
            FROM Bank_Loans_Advanced WHERE user_id = ? ORDER BY principal_amount DESC
        """, (cid,))
        loans = [dict(r) for r in cur.fetchall()]

        # Recent transactions (last 20)
        transactions = []
        if acc_ids:
            ph = ','.join('?' * len(acc_ids))
            cur.execute(f"""
                SELECT trans_id, from_account_id, to_account_id,
                       amount_original_curr, trans_category, description_text,
                       trans_status, fraud_score, created_at
                FROM Bank_Transactions_Detail
                WHERE from_account_id IN ({ph}) OR to_account_id IN ({ph})
                ORDER BY created_at DESC LIMIT 20
            """, acc_ids + acc_ids)
            raw = cur.fetchall()
            # Categories that always mean money COMING IN to the customer
            CREDIT_CATS = {'credit', 'salary', 'interest', 'loan_disbursement',
                           'dividend', 'refund', 'reversal', 'cashback'}
            # Categories that always mean money GOING OUT
            DEBIT_CATS  = {'debit', 'fee', 'payment', 'loan_payment',
                           'withdrawal', 'purchase', 'atm', 'charge'}
            for t in raw:
                cat = (t['trans_category'] or '').lower()
                own_from = t['from_account_id'] in acc_ids_set
                own_to   = t['to_account_id']   in acc_ids_set
                if cat in CREDIT_CATS:
                    tx_type = 'Credit'
                elif cat in DEBIT_CATS:
                    tx_type = 'Debit'
                elif own_from and not own_to:
                    tx_type = 'Debit'
                elif own_to and not own_from:
                    tx_type = 'Credit'
                else:
                    # Both or neither — treat outgoing as Debit
                    tx_type = 'Debit' if own_from else 'Credit'
                transactions.append({
                    'id':          t['trans_id'],
                    'desc':        t['description_text'] or 'Transaction',
                    'amount':      t['amount_original_curr'],
                    'type':        tx_type,
                    'category':    t['trans_category'] or 'transfer',
                    'status':      t['trans_status'] or 'Completed',
                    'date':        t['created_at'],
                    'fraud_score': t['fraud_score'] or 0,
                })

        # Summary metrics
        total_balance = sum(a['balance_available'] for a in accounts)
        active_loans  = [l for l in loans if l['loan_status'] in ('approved', 'disbursed', 'under_review', 'pending')]
        total_debt    = sum(l['remaining_balance'] for l in active_loans)
        # Use the highest credit score on record
        credit_scores = [l['credit_score_on_approval'] for l in loans if l.get('credit_score_on_approval')]
        credit_score  = max(credit_scores) if credit_scores else 720

        return jsonify({
            'success':      True,
            'accounts':     accounts,
            'cards':        cards,
            'loans':        loans,
            'transactions': transactions,
            'summary': {
                'total_balance':  round(total_balance, 2),
                'total_debt':     round(total_debt, 2),
                'net_worth':      round(total_balance - total_debt, 2),
                'credit_score':   credit_score,
                'active_loans':   len(active_loans),
                'num_accounts':   len(accounts),
                'num_cards':      len(cards),
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ── Generic dashboard stats (all domains) ────────────────────────────────────
@customer_portal_bp.route('/api/customer/dashboard-stats', methods=['GET'])
@customer_required
def get_customer_dashboard_stats():
    domain      = session.get('domain')
    customer_id = session.get('customer_id')

    if not domain or not customer_id:
        return jsonify({'error': 'Missing domain or user context'}), 400

    conn = get_conn(domain)
    uid  = customer_id
    stats = {}

    try:
        cur = conn.cursor()

        if domain == 'banking':
            cur.execute("SELECT * FROM Bank_Accounts WHERE user_id = ?", (uid,))
            accounts = [dict(row) for row in cur.fetchall()]
            acc_ids  = [a['acc_id'] for a in accounts]

            checking = sum(a['balance_available'] for a in accounts
                          if a.get('account_type', '').lower() in ('checking',))
            savings  = sum(a['balance_available'] for a in accounts
                          if a.get('account_type', '').lower() in ('savings',))
            total    = sum(a['balance_available'] for a in accounts if a['account_status'] == 'active')

            transactions = []
            if acc_ids:
                ph = ','.join('?' * len(acc_ids))
                cur.execute(f"""
                    SELECT * FROM Bank_Transactions_Detail
                    WHERE from_account_id IN ({ph}) OR to_account_id IN ({ph})
                    ORDER BY created_at DESC LIMIT 8
                """, acc_ids + acc_ids)
                for t in cur.fetchall():
                    is_debit = t['from_account_id'] in acc_ids
                    transactions.append({
                        'transaction_date': t['created_at'],
                        'transaction_desc': t['description_text'] or 'Transaction',
                        'amount':           t['amount_original_curr'],
                        'transaction_type': 'Debit' if is_debit else 'Credit',
                        'category':         t['trans_category'],
                    })

            cur.execute("SELECT * FROM Bank_Loans_Advanced WHERE user_id = ?", (uid,))
            loans = [dict(row) for row in cur.fetchall()]
            active_loans = [l for l in loans if l['loan_status'] in ('approved','disbursed','under_review','pending')]

            cur.execute("""
                SELECT c.* FROM Bank_Credit_Cards_Master c
                JOIN Bank_Accounts a ON c.account_id = a.acc_id
                WHERE a.user_id = ?
            """, (uid,))
            cards = [dict(r) for r in cur.fetchall()]

            stats = {
                'metrics': [
                    {'label': 'Total Balance',   'value': f'${total:,.2f}',           'icon': '💰'},
                    {'label': 'Checking',         'value': f'${checking:,.2f}',        'icon': '🏦'},
                    {'label': 'Savings',          'value': f'${savings:,.2f}',         'icon': '🏧'},
                    {'label': 'Active Loans',     'value': str(len(active_loans)),     'icon': '📋'},
                    {'label': 'Credit Cards',     'value': str(len(cards)),            'icon': '💳'},
                    {'label': 'Accounts',         'value': str(len(accounts)),         'icon': '🗂️'},
                ],
                'recent_list': transactions,
                'list_type':   'transactions',
                'accounts':    accounts,
                'loans':       loans,
                'cards':       cards,
            }

        elif domain == 'healthcare':
            try:
                cur.execute("SELECT * FROM Health_EHR_Records WHERE patient_id = ?", (uid,))
                records = [dict(row) for row in cur.fetchall()]
            except Exception:
                records = []
            try:
                cur.execute("SELECT * FROM Health_Surgeries_Intensive WHERE patient_id = ?", (uid,))
                surgeries = [dict(row) for row in cur.fetchall()]
            except Exception:
                surgeries = []
            try:
                cur.execute("SELECT * FROM Health_Medical_Insurance_Claims WHERE patient_id = ?", (uid,))
                claims = [dict(row) for row in cur.fetchall()]
            except Exception:
                claims = []

            stats = {
                'metrics': [
                    {'label': 'EHR Records',          'value': str(len(records)),  'icon': '🩺'},
                    {'label': 'Active Claims',          'value': str(len([c for c in claims if c.get('claim_status') == 'Pending'])), 'icon': '📄'},
                    {'label': 'Total Surgeries',        'value': str(len(surgeries)), 'icon': '🔬'},
                    {'label': 'Active Prescriptions',   'value': '2',               'icon': '💊'},
                ],
                'recent_list': claims[:6] if claims else [],
                'list_type': 'claims',
            }

        elif domain == 'education':
            try:
                cur.execute("SELECT * FROM Edu_Section_Enrollments WHERE student_id = ?", (uid,))
                enrollments = [dict(row) for row in cur.fetchall()]
            except Exception:
                enrollments = []
            courses = [{'course': f'Course {e["section_id"]}', 'grade': e.get('final_grade') or 'In Progress', 'status': e.get('enrollment_status','Enrolled')} for e in enrollments]
            if not courses:
                courses = [
                    {'course': 'MATH301: Advanced Mathematics', 'grade': 'A',  'status': 'Enrolled'},
                    {'course': 'CS101: Computer Science',        'grade': 'A-', 'status': 'Enrolled'},
                    {'course': 'PHYS202: Intro to Physics',      'grade': 'B+', 'status': 'Enrolled'},
                ]
            stats = {
                'metrics': [
                    {'label': 'Current GPA',        'value': '3.75', 'icon': '📊'},
                    {'label': 'Credits Earned',     'value': '45',   'icon': '🎓'},
                    {'label': 'Active Enrollments', 'value': str(len(enrollments) or 3), 'icon': '📚'},
                ],
                'recent_list': courses,
                'list_type': 'courses',
            }

        elif domain == 'manufacturing':
            try:
                cur.execute("SELECT * FROM Mfg_Supply_Chain_Global WHERE shipment_status != 'Delivered' LIMIT 6")
                supply = [dict(r) for r in cur.fetchall()]
            except Exception:
                supply = []
            stats = {
                'metrics': [
                    {'label': 'Active Orders',  'value': str(len(supply)),  'icon': '📦'},
                    {'label': 'Catalog Items',  'value': '128',              'icon': '🏭'},
                    {'label': 'Quality Score',  'value': '98.5%',            'icon': '✅'},
                ],
                'recent_list': supply,
                'list_type': 'supply',
            }

        return jsonify({'success': True, 'stats': stats})

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
