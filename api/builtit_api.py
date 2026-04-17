import os
from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from api.builtit_agent import M8DevAgent
from database.db_manager import create_record

m8dev_bp = Blueprint('m8dev', __name__)

@m8dev_bp.route('/api/m8dev/task', methods=['POST'])
@login_required
def execute_m8dev_task():
    """
    Admin-only endpoint to trigger the M.8 DEV Autonomous Agent.
    """
    # 1. Security Check: Only allow 'admin' role to use M.8 DEV
    # In a production setting, this could be even more restricted (e.g. specialized 'developer' role)
    if session.get('role') != 'admin':
        return jsonify({"error": "Forbidden. Only administrators can access M.8 DEV."}), 403

    data = request.get_json() or {}
    task_prompt = data.get('task', '').strip()

    if not task_prompt:
        return jsonify({"error": "Task prompt is required."}), 400

    domain = session.get('domain', 'banking')

    try:
        # 2. Log the execution of M.8 DEV for audit purposes
        create_record(domain, 'metrics', {
            'name': 'm8dev_execution',
            'department': 'engineering',
            'value': 1,
            'unit': 'count',
            'period': 'realtime',
            'date': __import__('datetime').datetime.now().strftime('%Y-%m-%d')
        })

        # 3. Initialize the M.8 DEV Agent
        # Restrict workspace root to the current project directory or specifically the templates/static folders
        workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        agent = M8DevAgent(workspace_root=workspace_root)
        
        # 4. Execute the task
        result = agent.execute_task(task_prompt)

        return jsonify({
            "status": "success",
            "model": "M.8 DEV",
            "message": "Task processed successfully.",
            "output": result
        }), 200

    except PermissionError as pe:
        return jsonify({
            "status": "error",
            "error": "M.8 DEV blocked an unauthorized action.",
            "details": str(pe)
        }), 403
    except Exception as e:
        return jsonify({
            "status": "error",
            "error": "M.8 DEV experienced a critical failure.",
            "details": str(e)
        }), 500
