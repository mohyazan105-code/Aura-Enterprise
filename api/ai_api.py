from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from api.ai_engine import AuraAI
from database.db_manager import create_record, get_records

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/api/ai/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json() or {}
    message = data.get('message', '').strip()
    history = data.get('history', [])
    
    user_dept = session.get('department')
    if user_dept and session.get('role') != 'admin':
        department = user_dept
    else:
        department = data.get('department', 'hr')

    if not message:
        return jsonify({'error': 'Message is required'}), 400

    domain = session.get('domain', 'banking')
    role = session.get('role', 'operator')

    ai = AuraAI(domain, department, role, session.get('user_id'))
    response = ai.chat(message, history)

    # Log the interaction
    try:
        create_record(domain, 'metrics', {
            'name': 'ai_interaction',
            'department': department,
            'value': 1,
            'unit': 'count',
            'period': 'realtime',
            'date': __import__('datetime').datetime.now().strftime('%Y-%m-%d')
        })
    except Exception:
        pass

    return jsonify({'response': response, 'message': message})


@ai_bp.route('/api/ai/insights', methods=['GET'])
@login_required
def auto_insights():
    """Generate automatic insights for current domain/department."""
    domain = session.get('domain', 'banking')
    
    user_dept = session.get('department')
    if user_dept and session.get('role') != 'admin':
        dept = user_dept
    else:
        dept = request.args.get('department', 'hr')
        
    role = session.get('role', 'operator')
    ai = AuraAI(domain, dept, role, session.get('user_id'))
    ctx = ai._load_context()
    kpi = ai._kpi_analysis(ctx)
    return jsonify({'insights': kpi})


@ai_bp.route('/api/ai/decision', methods=['POST'])
@login_required
def record_decision():
    data = request.get_json() or {}
    domain = session.get('domain')
    data['domain'] = domain
    data['decided_by'] = session.get('user_id')
    rid = create_record(domain, 'decisions', data)
    return jsonify({'success': True, 'id': rid})


@ai_bp.route('/api/ai/decisions', methods=['GET'])
@login_required
def list_decisions():
    domain = session.get('domain')
    rows, total = get_records(domain, 'decisions', limit=50)
    return jsonify({'decisions': rows, 'total': total})


@ai_bp.route('/api/ai/suggest_contact', methods=['POST'])
@login_required
def suggest_contact():
    data = request.get_json() or {}
    intent = data.get('intent', '').strip()
    if not intent:
        return jsonify({'error': 'Intent is required'}), 400
        
    domain = session.get('domain', 'banking')
    dept = session.get('department', 'general')
    role = session.get('role', 'operator')
    user_id = session.get('user_id')
    
    ai = AuraAI(domain, dept, role, user_id)
    suggestion = ai.suggest_contacts(intent)
    return jsonify(suggestion)


@ai_bp.route('/api/ai/my_impact', methods=['GET'])
@login_required
def get_my_impact():
    domain = session.get('domain', 'banking')
    user_id = session.get('user_id')
    
    try:
        from database.db_manager import get_conn, ensure_learning_schema
        conn = get_conn(domain)
        try:
            ensure_learning_schema(conn)
            prof = conn.execute("SELECT * FROM user_ai_profiles WHERE user_id=?", (user_id,)).fetchone()
            if not prof:
                return jsonify({'efficiency_score': 50.0, 'status': 'learning'})
            return jsonify(dict(prof))
        finally:
            conn.close()
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/api/ai/explain_kpi', methods=['POST'])
@login_required
def explain_kpi():
    data = request.get_json() or {}
    kpi_name = data.get('kpi_name')
    if not kpi_name:
        return jsonify({'error': 'kpi_name is required'}), 400
        
    value = data.get('value', '')
    trend = data.get('trend', '')
    lang = data.get('lang', 'en')
    
    domain = session.get('domain', 'banking')
    dept = session.get('department', 'general')
    role = session.get('role', 'operator')
    user_id = session.get('user_id')
    
    ai = AuraAI(domain, dept, role, user_id)
    result = ai.explain_kpi(kpi_name, value, trend, lang)
    return jsonify(result)
