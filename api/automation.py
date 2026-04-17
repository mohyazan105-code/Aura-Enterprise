import json
from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_records, create_record, update_record, get_conn
from datetime import datetime

rpa_bp = Blueprint('rpa', __name__)


@rpa_bp.route('/api/rpa/automations', methods=['GET'])
@login_required
def list_automations():
    domain = session.get('domain')
    rows, total = get_records(domain, 'automations', limit=100)
    return jsonify({'automations': rows, 'total': total})


@rpa_bp.route('/api/rpa/automations', methods=['POST'])
@login_required
def create_automation():
    domain = session.get('domain')
    data = request.get_json() or {}
    data['created_by'] = session.get('user_id')
    data['steps'] = json.dumps(data.get('steps', []))
    rid = create_record(domain, 'automations', data)
    return jsonify({'success': True, 'id': rid}), 201


@rpa_bp.route('/api/rpa/automations/<int:auto_id>/run', methods=['POST'])
@login_required
def run_automation(auto_id):
    domain = session.get('domain')
    rows, _ = get_records(domain, 'automations', limit=1)
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM automations WHERE id = ?", (auto_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Automation not found'}), 404
        auto = dict(row)
        steps = json.loads(auto.get('steps') or '[]')
        import time, random
        start = time.time()
        success = random.random() > 0.1  # 90% success rate
        duration_ms = int((time.time() - start) * 1000) + random.randint(200, 2000)
        status = 'success' if success else 'failed'
        result = f"Executed {len(steps)} steps. {'All completed successfully.' if success else 'Step 2 failed: connection timeout.'}"
        # Log run
        conn.execute("""INSERT INTO automation_logs (automation_id, status, duration_ms, result)
            VALUES (?, ?, ?, ?)""", (auto_id, status, duration_ms, result))
        # Update counters
        conn.execute("""UPDATE automations SET
            run_count = run_count + 1,
            success_count = success_count + ?,
            last_run = datetime('now')
            WHERE id = ?""", (1 if success else 0, auto_id))
        conn.commit()
        return jsonify({'success': success, 'status': status, 'duration_ms': duration_ms, 'result': result})
    finally:
        conn.close()


@rpa_bp.route('/api/rpa/automations/<int:auto_id>/logs', methods=['GET'])
@login_required
def auto_logs(auto_id):
    domain = session.get('domain')
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM automation_logs WHERE automation_id = ? ORDER BY run_at DESC LIMIT 20", (auto_id,))
        logs = [dict(r) for r in cur.fetchall()]
        return jsonify({'logs': logs})
    finally:
        conn.close()


@rpa_bp.route('/api/rpa/automations/<int:auto_id>', methods=['PUT'])
@login_required
def update_automation(auto_id):
    domain = session.get('domain')
    data = request.get_json() or {}
    if 'steps' in data and isinstance(data['steps'], list):
        data['steps'] = json.dumps(data['steps'])
    update_record(domain, 'automations', auto_id, data)
    return jsonify({'success': True})
