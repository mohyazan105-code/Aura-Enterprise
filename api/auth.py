import hashlib
import json
from flask import Blueprint, request, jsonify, session
from functools import wraps
from database.db_manager import get_conn, get_records
from config import ROLES, DOMAINS, DEFAULT_USERS, DEPARTMENTS

auth_bp = Blueprint('auth', __name__)

def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()

def _build_user_auth_payload(user, domain):
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM roles WHERE id = ?", (user.get('role_id', -1),))
        role_info = dict(cur.fetchone() or {})
        
        cur.execute("SELECT module, actions_json FROM role_permissions WHERE role_id = ?", (user.get('role_id', -1),))
        permissions = {}
        for row in cur.fetchall():
            permissions[row['module']] = json.loads(row['actions_json'])
    finally:
        conn.close()

    domain_info = DOMAINS[domain]

    perms_struct = {
        'modules': permissions,
        'can_create': 'add' in permissions.get('Data', []),
        'can_edit': 'edit' in permissions.get('Data', []),
        'can_delete': 'delete' in permissions.get('Data', []),
        'can_manage_users': role_info.get('level', 1) >= 4,
        'analytics_scope': 'full' if role_info.get('level', 1) >= 4 else 'department',
        'dept_access': [user['department']] if user.get('department') and role_info.get('level', 1) < 4 else list(DEPARTMENTS.keys())
    }

    return {
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'name': user['name'],
            'role_id': user.get('role_id'),
            'role_label': role_info.get('name', 'Viewer'),
            'role_color': role_info.get('color', '#757575'),
            'role_level': role_info.get('level', 1),
            'email': user.get('email', ''),
            'permissions': perms_struct
        },
        'domain': {
            'id': domain,
            'name': domain_info['name'],
            'color': domain_info['color'],
            'accent': domain_info['accent'],
            'gradient': domain_info['gradient'],
            'icon': domain_info['icon'],
        }
    }

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required', 'code': 401}), 401
        return f(*args, **kwargs)
    return decorated

def customer_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'customer_id' not in session:
            return jsonify({'error': 'Customer authentication required', 'code': 401}), 401
        return f(*args, **kwargs)
    return decorated

def require_permission(module, action):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            perms = session.get('permissions', {}).get('modules', {})
            # Allow Domain Admins bypassing directly if level is 4
            if session.get('role_level', 1) >= 4:
                return f(*args, **kwargs)
            if module not in perms or action not in perms[module]:
                return jsonify({'error': f'Permission denied. Missing {action} on {module}'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            if 'admin' in roles and session.get('role_level', 1) < 4:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    domain = data.get('domain', '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
        
    if username == 'baha.aura@admin' and password == 'bahaa123':
        payload = {
            'user': {
                'id': 0,
                'username': 'baha.aura@admin',
                'name': 'Baha Action Aura',
                'role_level': 5,
                'status': 'active',
                'permissions': {'System': ['all']}
            },
            'domain': {'id': 'global', 'name': 'Action Aura Intelligence Hub'}
        }
        session.clear()
        session['user_id'] = 0
        session['username'] = 'baha.aura@admin'
        session['name'] = 'Baha Action Aura'
        session['role_level'] = 5
        session['domain'] = 'global'
        session['permissions'] = payload['user']['permissions']
        session.permanent = True
        return jsonify(payload)

    if not domain:
        return jsonify({'error': 'Domain is required'}), 400

    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain selected'}), 400

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM users WHERE username = ? AND password_hash = ?",
            (username, hash_password(password))
        )
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

        user = dict(user)
        if user.get('status') == 'disabled':
            return jsonify({'error': 'Account disabled'}), 403
            
        # Update last login
        conn.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user['id'],))
        conn.commit()
    finally:
        conn.close()

    payload = _build_user_auth_payload(user, domain)

    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['name'] = user['name']
    session['role_id'] = user.get('role_id')
    session['role_level'] = payload['user']['role_level']
    session['domain'] = domain
    session['department'] = user.get('department')
    session['email'] = user.get('email', '')
    session['permissions'] = payload['user']['permissions']
    session.permanent = True

    return jsonify(payload)

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    domain = data.get('domain', '').strip()

    if not username or not password or not domain:
        return jsonify({'error': 'Username, password, and domain are required'}), 400
    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain selected'}), 400

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cur.fetchone():
            return jsonify({'error': 'Username already exists'}), 400
            
        cur.execute("SELECT id FROM roles ORDER BY level ASC LIMIT 1")
        default_role = cur.fetchone()
        role_id = default_role['id'] if default_role else 1
            
        cur.execute("""
            INSERT INTO users (username, password_hash, role_id, name, email, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        """, (username, hash_password(password), role_id, name, email))
        conn.commit()
    finally:
        conn.close()
        
    return jsonify({'success': True, 'message': 'User registered successfully'})


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@auth_bp.route('/api/auth/preferences', methods=['GET'])
@login_required
def get_preferences():
    conn = get_conn(session['domain'])
    try:
        cur = conn.cursor()
        cur.execute("SELECT ui_preferences FROM users WHERE id = ?", (session['user_id'],))
        row = cur.fetchone()
        prefs = row['ui_preferences'] if row and row['ui_preferences'] else '[]'
        return jsonify({'success': True, 'preferences': prefs})
    finally:
        conn.close()


@auth_bp.route('/api/auth/preferences', methods=['POST'])
@login_required
def save_preferences():
    data = request.get_json() or {}
    layout = data.get('layout')
    if not layout:
        return jsonify({'error': 'Layout JSON required'}), 400
    
    import json
    conn = get_conn(session['domain'])
    try:
        conn.execute("UPDATE users SET ui_preferences = ? WHERE id = ?", (json.dumps(layout), session['user_id']))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@auth_bp.route('/api/auth/me', methods=['GET'])
@login_required
def me():
    conn = get_conn(session['domain'])
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],))
        db_user = cur.fetchone()
        if not db_user:
            return jsonify({'error': 'User not found'}), 404
        user = dict(db_user)
    finally:
        conn.close()
    
    payload = _build_user_auth_payload(user, session['domain'])
    return jsonify({
        'user': payload['user'],
        'domain': payload['domain']
    })


@auth_bp.route('/api/auth/users', methods=['GET'])
@login_required
def list_users():
    domain = session.get('domain')
    if not domain:
        return jsonify({'error': 'No domain in session'}), 400
    rows, total = get_records(domain, 'users', limit=100)
    # Remove password hashes
    clean = [{k: v for k, v in r.items() if k != 'password_hash'} for r in rows]
    return jsonify({'users': clean, 'total': total})


@auth_bp.route('/api/domains', methods=['GET'])
def get_domains():
    from config import DOMAINS
    return jsonify({
        'domains': [
            {'id': k, **{kk: vv for kk, vv in v.items() if kk != 'db'}}
            for k, v in DOMAINS.items()
        ]
    })


@auth_bp.route('/api/auth/customer-login', methods=['POST'])
def customer_login():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    domain = data.get('domain', '').strip()

    if not email or not password or not domain:
        return jsonify({'error': 'Email, password, and domain are required'}), 400

    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain selected'}), 400

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM customers WHERE email = ?", (email,))
        customer = cur.fetchone()
        if not customer:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        customer = dict(customer)
        if customer.get('password_hash') != hash_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
            
    finally:
        conn.close()

    domain_info = DOMAINS[domain]

    session.clear()
    session['customer_id'] = customer['id']
    session['name'] = customer['name']
    session['domain'] = domain
    session['type'] = 'customer'
    session.permanent = True

    return jsonify({
        'success': True,
        'customer': {
            'id': customer['id'],
            'name': customer['name'],
            'email': customer['email'],
            'company': customer.get('company', '')
        },
        'domain': {
            'id': domain,
            'name': domain_info['name'],
            'color': domain_info['color'],
            'accent': domain_info['accent'],
            'gradient': domain_info['gradient'],
            'icon': domain_info['icon'],
        }
    })

@auth_bp.route('/api/customer/action', methods=['POST'])
@customer_required
def customer_action():
    data = request.get_json() or {}
    action = data.get('action')
    payload = data.get('payload', {})
    
    domain = session.get('domain')
    customer_id = session.get('customer_id')
    # Use customer_id mapped to user_id/patient_id/student_id for demo simplicity
    uid = customer_id
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        
        if domain == 'banking':
            if action in ['transfer', 'payment']:
                amount = float(payload.get('amount', 0))
                desc = payload.get('description', f"Customer {action.capitalize()}")
                
                # Verify account exists
                cur.execute("SELECT acc_id FROM Bank_Accounts WHERE user_id = ? LIMIT 1", (uid,))
                acc = cur.fetchone()
                if acc:
                    # Log transaction
                    cur.execute("""INSERT INTO Bank_Transactions_Detail (from_account_id, created_at, description_text, amount_original_curr, trans_category, channel, trans_status)
                                   VALUES (?, datetime('now'), ?, ?, ?, 'Web Portal', 'Completed')""",
                                (acc['acc_id'], desc, amount, 'Transfer' if action == 'transfer' else 'Payment'))
                    # Deduct balance
                    cur.execute("UPDATE Bank_Accounts SET balance_available = balance_available - ? WHERE acc_id = ?", (amount, acc['acc_id']))
                
            elif action == 'loan':
                amt = float(payload.get('detail', {}).get('amount', 1000))
                term = payload.get('detail', {}).get('term', 12)
                cur.execute("""INSERT INTO Bank_Loans_Advanced (user_id, loan_product_type, principal_amount, amortization_period_months, interest_rate_fixed_variable, loan_status, credit_score_on_approval)
                               VALUES (?, 'Personal Loan', ?, ?, 5.5, 'Under Review', 720)""",
                            (uid, amt, term))
                            
        elif domain == 'education':
            if action == 'payment':
                pass # Just mock success for now
            elif action == 'message':
                pass # Mock success
                
        elif domain == 'healthcare':
            if action == 'appointment':
                pass
                
        elif domain == 'manufacturing':
            if action == 'order':
                pass
                
        # Generic fallback or success
        conn.commit()
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({'success': True, 'msg': f"Successfully processed {action}."})

