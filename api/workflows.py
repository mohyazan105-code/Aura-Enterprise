from flask import Blueprint, request, jsonify, session
from api.auth import login_required, customer_required
from database.db_manager import get_conn
import json
from datetime import datetime

workflows_bp = Blueprint('workflows', __name__)

def _domain():
    return session.get('domain', 'banking')

def _user_id():
    return session.get('user_id')

def _dept():
    return session.get('department')

@workflows_bp.route('/api/workflows/definitions', methods=['GET'])
@login_required
def get_definitions():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM workflow_definitions WHERE domain = ? AND is_active = 1", (domain.capitalize(),))
        defs = [dict(r) for r in cur.fetchall()]
        return jsonify({'definitions': defs})
    finally:
        conn.close()

@workflows_bp.route('/api/workflows/instances', methods=['GET'])
@login_required
def get_instances():
    domain = _domain()
    dept = _dept()
    role = session.get('role')
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        query = """
            SELECT i.*, d.name as workflow_name, d.steps_json
            FROM workflow_instances i
            JOIN workflow_definitions d ON i.definition_id = d.id
        """
        params = []
        if role != 'admin':
            query += " WHERE d.department = ? OR i.assigned_dept = ?"
            params = [dept, dept]
        
        cur.execute(query, params)
        instances = [dict(r) for r in cur.fetchall()]
        return jsonify({'instances': instances})
    finally:
        conn.close()

@workflows_bp.route('/api/workflows/start', methods=['POST'])
def start_workflow():
    """Trigger a workflow (can be called by authenticated staff or customer portal session)."""
    # Must have either a staff session OR a customer session
    if 'user_id' not in session and 'customer_id' not in session:
        return jsonify({'error': 'Authentication required', 'code': 401}), 401
    data = request.get_json() or {}
    def_id = data.get('definition_id')
    customer_id = session.get('customer_id')
    payload = data.get('data', {})
    domain = data.get('domain', _domain())

    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM workflow_definitions WHERE id = ?", (def_id,))
        defn = cur.fetchone()
        if not defn:
            return jsonify({'error': 'Workflow definition not found'}), 404
        
        defn = dict(defn)
        steps = json.loads(defn['steps_json'])
        
        # Create instance
        history = [{
            'step': 1,
            'action': 'started',
            'user': customer_id or 'System',
            'timestamp': datetime.now().isoformat(),
            'comment': 'Workflow initiated'
        }]
        
        cur.execute("""
            INSERT INTO workflow_instances (definition_id, customer_id, current_step, status, data_json, history_json, assigned_dept)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (def_id, customer_id, 1, 'active', json.dumps(payload), json.dumps(history), defn['department']))
        
        instance_id = cur.lastrowid
        
        # Create notification for target department
        conn.execute("""
            INSERT INTO notifications (department, message, type, reference_id)
            VALUES (?, ?, ?, ?)
        """, (defn['department'], f"New Process Started: {defn['name']} (#{instance_id})", 'workflow', instance_id))
        
        conn.commit()
        return jsonify({'success': True, 'instance_id': instance_id})
    finally:
        conn.close()

@workflows_bp.route('/api/workflows/action', methods=['POST'])
@login_required
def take_action():
    data = request.get_json() or {}
    instance_id = data.get('instance_id')
    action = data.get('action') # approve, reject, more_info
    comment = data.get('comment', '')
    
    domain = _domain()
    user_id = _user_id()
    dept = _dept()
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT i.*, d.steps_json, d.name as workflow_name
            FROM workflow_instances i
            JOIN workflow_definitions d ON i.definition_id = d.id
            WHERE i.id = ?
        """, (instance_id,))
        inst = cur.fetchone()
        if not inst:
            return jsonify({'error': 'Instance not found'}), 404
            
        inst = dict(inst)
        steps = json.loads(inst['steps_json'])
        current_step_idx = inst['current_step'] - 1
        
        # Simple transition logic
        new_step = inst['current_step']
        new_status = inst['status']
        
        history = json.loads(inst['history_json'])
        history.append({
            'step': inst['current_step'],
            'action': action,
            'user': user_id,
            'timestamp': datetime.now().isoformat(),
            'comment': comment
        })
        
        if action == 'approve':
            if inst['current_step'] < len(steps):
                new_step += 1
                new_status = 'active'
            else:
                new_status = 'completed'
        elif action == 'reject':
            new_status = 'rejected'
        elif action == 'more_info':
            new_status = 'more_info'
            
        cur.execute("""
            UPDATE workflow_instances
            SET current_step = ?, status = ?, history_json = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (new_step, new_status, json.dumps(history), instance_id))
        
        # User Experience Learning Hook
        if user_id:
            from database.db_manager import ensure_learning_schema
            ensure_learning_schema(conn)
            outcome_val = 'success' if action == 'approve' else ('failure' if action == 'reject' else 'neutral')
            cur.execute("""
                INSERT INTO user_action_logs (user_id, action_type, context, outcome)
                VALUES (?, ?, ?, ?)
            """, (user_id, f"workflow_{action}", f"Processed {inst.get('workflow_name', 'Workflow')}", outcome_val))
            
            # Recalculate basic efficiency
            if outcome_val == 'success':
                cur.execute("UPDATE user_ai_profiles SET efficiency_score = MIN(100.0, efficiency_score + 1.5) WHERE user_id = ?", (user_id,))
            elif outcome_val == 'failure':
                cur.execute("UPDATE user_ai_profiles SET efficiency_score = MAX(0.0, efficiency_score - 0.5) WHERE user_id = ?", (user_id,))

        conn.commit()
        return jsonify({'success': True, 'new_status': new_status, 'current_step': new_step})
    finally:
        conn.close()
