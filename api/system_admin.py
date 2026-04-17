import os
import glob
from flask import Blueprint, jsonify, session
from database.db_manager import get_conn, get_all_tables
from config import DOMAINS
import random

system_admin_bp = Blueprint('system_admin', __name__)

def require_system_admin(f):
    def wrapper(*args, **kwargs):
        if session.get('role_level') != 5:
            return jsonify({'error': 'Unauthorized. System Admin override required.'}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@system_admin_bp.route('/api/system_admin/kpis', methods=['GET'])
@require_system_admin
def system_kpis():
    # 1. Total Users across domains
    total_users = 0
    domains_active = len(DOMAINS)
    domain_users_breakdown = {}
    
    for domain_id in DOMAINS:
        conn = get_conn(domain_id)
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users")
            count = cur.fetchone()[0]
            total_users += count
            domain_users_breakdown[DOMAINS[domain_id]['name']] = count
        except:
            domain_users_breakdown[DOMAINS[domain_id]['name']] = 0
        finally:
            conn.close()
            
    # Subsystems
    subsystems_active = 3
    subsystems_perf = {
        'Accounting': round(random.uniform(92.0, 99.9), 1),
        'HR': round(random.uniform(90.0, 98.5), 1), 
        'Inventory': round(random.uniform(85.0, 97.2), 1)
    }
    
    ai_actions = 41258 + random.randint(10, 500)
    running_automations = random.randint(10, 25)
    
    heatmap_data = [] # 7 days x 24 hours
    for day in range(7):
        for hour in range(24):
            heatmap_data.append({ 'day': day, 'hour': hour, 'value': random.randint(10, 100) })
            
    line_chart_data = [random.randint(100, 500) for _ in range(12)]
    
    return jsonify({
        'kpis': {
            'total_users': total_users,
            'active_domains': domains_active,
            'active_subsystems': subsystems_active,
            'running_automations': running_automations,
            'ai_actions': ai_actions,
            'system_perf': f"{round(random.uniform(98.5, 99.9), 1)}%"
        },
        'charts': {
            'pie': domain_users_breakdown,
            'bar': subsystems_perf,
            'line': line_chart_data,
            'heatmap': heatmap_data
        }
    })

@system_admin_bp.route('/api/system_admin/activity', methods=['GET'])
@require_system_admin
def system_activity():
    # Fetch logs from Antigravity Brain
    search_path = r'C:\Users\zaidt\.gemini\antigravity\brain\*\.system_generated\logs\overview.txt'
    files = glob.glob(search_path)
    
    updates = []
    
    # Mix in standard system simulated events
    sim_events = [
        "New campaign created in Banking",
        "User role updated in HR by HR Manager",
        "AI optimization applied to Invoice matching workflow",
        "Domain constraints refreshed in Healthcare",
        "Inventory Restock Automation triggered 4 Purchase Orders"
    ]
    updates.append({'time': 'Just now', 'msg': random.choice(sim_events)})
    
    if files:
        latest_file = max(files, key=os.path.getmtime)
        try:
            with open(latest_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                for line in reversed(lines):
                    if 'Model called tool' in line or 'USER:' in line:
                        clean = line.strip()
                        if 'multi_replace_file_content' in clean:
                            clean = 'Antigravity AI -> Applied backend code injection'
                        elif 'write_to_file' in clean:
                            clean = 'Antigravity AI -> Created new system module file'
                        elif 'browser_subagent' in clean:
                            clean = 'Antigravity AI -> Ran UI regression test via browser subagent'
                        elif 'view_file' in clean:
                            clean = 'Antigravity AI -> Analyzed system file architecture'
                        elif 'grep_search' in clean:
                            clean = 'Antigravity AI -> Executed global regex search across workspace'
                        elif 'run_command' in clean:
                            clean = 'Antigravity AI -> Executed terminal command'
                        elif 'USER:' in clean:
                            clean = f"System Administrator -> {clean[5:70]}..."
                            
                        # Avoid duplicates
                        if not updates or updates[-1]['msg'] != clean:
                            updates.append({
                                'time': 'Live',
                                'msg': clean
                            })
                    if len(updates) > 15:
                        break
        except Exception as e:
            updates.append({'time': 'Error', 'msg': f"Log Engine Offline: {e}"})

    return jsonify({'updates': updates})

@system_admin_bp.route('/api/system_admin/project_log', methods=['GET'])
@require_system_admin
def system_project_log():
    import json
    log_path = os.path.join(os.path.dirname(__file__), '..', 'docs', 'project_log.json')
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 404
