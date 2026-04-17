import json
from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn

rbac_bp = Blueprint('rbac', __name__)

@rbac_bp.route('/api/rbac/roles', methods=['GET'])
@login_required
def get_roles():
    if session.get('role_level', 1) < 4:
         return jsonify({'error': 'Domain Admin required'}), 403
         
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM roles ORDER BY level DESC")
        roles = [dict(r) for r in cur.fetchall()]
        
        for role in roles:
            cur.execute("SELECT module, actions_json FROM role_permissions WHERE role_id = ?", (role['id'],))
            perms = {}
            for row in cur.fetchall():
                perms[row['module']] = json.loads(row['actions_json'])
            role['permissions'] = perms
            
    finally:
        conn.close()
    return jsonify({'roles': roles})

@rbac_bp.route('/api/rbac/roles', methods=['POST'])
@login_required
def create_role():
    if session.get('role_level', 1) < 4:
         return jsonify({'error': 'Domain Admin required'}), 403
         
    data = request.get_json() or {}
    name = data.get('name')
    level = int(data.get('level', 1))
    color = data.get('color', '#1a73e8')
    permissions = data.get('permissions', {})
    
    if not name:
        return jsonify({'error': 'Role name required'}), 400
        
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO roles (name, level, color, built_in) VALUES (?, ?, ?, 0)", (name, level, color))
        role_id = cur.lastrowid
        
        for mod, actions in permissions.items():
            cur.execute("INSERT INTO role_permissions (role_id, module, actions_json) VALUES (?, ?, ?)", (role_id, mod, json.dumps(actions)))
        conn.commit()
    finally:
        conn.close()
    return jsonify({'success': True, 'role_id': role_id})

@rbac_bp.route('/api/rbac/roles/<int:role_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_role(role_id):
    if session.get('role_level', 1) < 4:
         return jsonify({'error': 'Domain Admin required'}), 403
         
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'DELETE':
            cur.execute("SELECT built_in FROM roles WHERE id = ?", (role_id,))
            r = cur.fetchone()
            if r and r['built_in']:
                return jsonify({'error': 'Cannot delete built-in roles'}), 400
            cur.execute("DELETE FROM roles WHERE id = ?", (role_id,))
            conn.commit()
            return jsonify({'success': True})
            
        data = request.get_json() or {}
        permissions = data.get('permissions')
        
        if permissions is not None:
             cur.execute("DELETE FROM role_permissions WHERE role_id = ?", (role_id,))
             for mod, actions in permissions.items():
                 cur.execute("INSERT INTO role_permissions (role_id, module, actions_json) VALUES (?, ?, ?)", (role_id, mod, json.dumps(actions)))
        conn.commit()
    finally:
        conn.close()
    return jsonify({'success': True})

@rbac_bp.route('/api/rbac/users/<int:user_id>/role', methods=['PUT'])
@login_required
def assign_role(user_id):
    if session.get('role_level', 1) < 4:
         return jsonify({'error': 'Domain Admin required'}), 403
         
    data = request.get_json() or {}
    role_id = data.get('role_id')
    
    if not role_id:
        return jsonify({'error': 'role_id required'}), 400
        
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET role_id = ? WHERE id = ?", (role_id, user_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({'success': True})

@rbac_bp.route('/api/rbac/users/<int:user_id>/status', methods=['PUT'])
@login_required
def toggle_status(user_id):
    if session.get('role_level', 1) < 4:
         return jsonify({'error': 'Domain Admin required'}), 403
         
    data = request.get_json() or {}
    status = data.get('status')
    
    if status not in ['active', 'disabled']:
         return jsonify({'error': 'Invalid status'}), 400
         
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({'success': True})
