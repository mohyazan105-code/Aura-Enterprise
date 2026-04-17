import json
import math
import random
import sqlite3
from datetime import datetime, timedelta
from database.db_manager import get_conn, get_records
from config import DEPARTMENTS, ROLES


# ──────────────────────────────────────────────────────────────────────────────
# Utility
# ──────────────────────────────────────────────────────────────────────────────

def _rows(domain, table, limit=500):
    rows, _ = get_records(domain, table, limit=limit)
    return rows


def _avg(lst): return sum(lst) / len(lst) if lst else 0
def _pct_change(old, new): return round((new - old) / old * 100, 1) if old else 0


# ──────────────────────────────────────────────────────────────────────────────
# Dashboard KPIs (role-filtered)
# ──────────────────────────────────────────────────────────────────────────────

def get_dashboard_kpis(domain, department, role):
    # Specialized Domain/Department KPIs mapping with indicator types
    
    if department == 'hr':
        if domain == 'banking':
            return [
                {'id': 'hr_sat', 'label': 'Employee Satisfaction', 'value': 8.2, 'unit': '/10', 'type': 'chart', 'icon': '😊', 'color': '#43a047', 'trend': '+0.3%', 'trend_dir': 'up'},
                {'id': 'hr_ret', 'label': 'Retention Rate', 'value': 94.5, 'unit': '%', 'type': 'trend', 'icon': '🛡️', 'color': '#1e88e5', 'trend': 'Stable', 'trend_dir': 'neutral'},
                {'id': 'hr_hire', 'label': 'Time-to-Hire', 'value': 22, 'unit': 'Days', 'type': 'gauge', 'icon': '⏳', 'color': '#f57c00', 'trend': '-2 days', 'trend_dir': 'up'}
            ]
        elif domain == 'healthcare':
            return [
                {'id': 'hr_comp', 'label': 'Staff Compliance', 'value': 99.2, 'unit': '%', 'type': 'progress', 'icon': '📋', 'color': '#43a047', 'trend': 'Regulatory target', 'trend_dir': 'neutral'},
                {'id': 'hr_train', 'label': 'Training Completion', 'value': 88.0, 'unit': '%', 'type': 'heatmap', 'icon': '📚', 'color': '#8e24aa', 'trend': 'Quarterly goal', 'trend_dir': 'up'},
                {'id': 'hr_ret', 'label': 'Clinical Retention', 'value': 91.2, 'unit': '%', 'type': 'trend', 'icon': '🩺', 'color': '#e53935', 'trend': '-1.5% YoY', 'trend_dir': 'down'}
            ]
        elif domain == 'education':
            return [
                {'id': 'hr_sat', 'label': 'Faculty Satisfaction', 'value': 7.8, 'unit': '/10', 'type': 'survey', 'icon': '🍎', 'color': '#43a047', 'trend': 'Peer avg 7.5', 'trend_dir': 'up'},
                {'id': 'hr_ratio', 'label': 'Student Support Ratio', 'value': '1:45', 'unit': '', 'type': 'table', 'icon': '🙋', 'color': '#1e88e5', 'trend': 'Target 1:40', 'trend_dir': 'down'},
                {'id': 'hr_ret', 'label': 'Staff Retention', 'value': 89.4, 'unit': '%', 'type': 'line', 'icon': '🏛️', 'color': '#fb8c00', 'trend': 'Academic year', 'trend_dir': 'neutral'}
            ]
        else: # Manufacturing
            return [
                {'id': 'hr_eff', 'label': 'Workforce Efficiency', 'value': 92.4, 'unit': '%', 'type': 'gauge', 'icon': '⚙️', 'color': '#1e88e5', 'trend': '+4.2% shift', 'trend_dir': 'up'},
                {'id': 'hr_safe', 'label': 'Safety Compliance', 'value': 100, 'unit': '%', 'type': 'checklist', 'icon': '🦺', 'color': '#43a047', 'trend': 'Zero incidents', 'trend_dir': 'neutral'},
                {'id': 'hr_ret', 'label': 'Operational Retention', 'value': 95.1, 'unit': '%', 'type': 'trend', 'icon': '🏢', 'color': '#8e24aa', 'trend': 'Above industry', 'trend_dir': 'up'}
            ]
            
    elif department == 'finance':
        if domain == 'banking':
            return [
                {'id': 'fin_rev', 'label': 'Revenue vs Budget', 'value': 104.2, 'unit': '%', 'type': 'line', 'icon': '💰', 'color': '#43a047', 'trend': '+$1.2M variance', 'trend_dir': 'up'},
                {'id': 'fin_var', 'label': 'Expense Variance', 'value': -2.1, 'unit': '%', 'type': 'bar', 'icon': '📉', 'color': '#1e88e5', 'trend': 'Under budget', 'trend_dir': 'up'},
                {'id': 'fin_cash', 'label': 'Cash Flow Efficiency', 'value': 0.92, 'unit': '', 'type': 'dashboard', 'icon': '🌊', 'color': '#8e24aa', 'trend': 'High liquidity', 'trend_dir': 'neutral'}
            ]
        elif domain == 'healthcare':
            return [
                {'id': 'fin_cost', 'label': 'Cost per Patient', 'value': 420.50, 'unit': '$', 'type': 'heatmap', 'icon': '🏥', 'color': '#e53935', 'trend': '-$12.00 avg', 'trend_dir': 'up'},
                {'id': 'fin_var', 'label': 'Dept Expense Variance', 'value': 1.4, 'unit': '%', 'type': 'bar', 'icon': '📁', 'color': '#fb8c00', 'trend': 'Slight overrun', 'trend_dir': 'down'},
                {'id': 'fin_cash', 'label': 'Operating Cash Flow', 'value': 2.4, 'unit': 'M', 'type': 'gauge', 'icon': '💵', 'color': '#43a047', 'trend': 'M/M Growth', 'trend_dir': 'up'}
            ]
        elif domain == 'education':
            return [
                {'id': 'fin_adh', 'label': 'Budget Adherence', 'value': 98.5, 'unit': '%', 'type': 'progress', 'icon': '🎓', 'color': '#43a047', 'trend': 'Institutional target', 'trend_dir': 'neutral'},
                {'id': 'fin_fund', 'label': 'Funding Utilization', 'value': 74.2, 'unit': '%', 'type': 'pie', 'icon': '🏦', 'color': '#1e88e5', 'trend': 'Grant cycling', 'trend_dir': 'neutral'},
                {'id': 'fin_tui', 'label': 'Tuition Collection', 'value': 91.8, 'unit': '%', 'type': 'line', 'icon': '📜', 'color': '#fb8c00', 'trend': 'Semester peak', 'trend_dir': 'up'}
            ]
        else: # Manufacturing
            return [
                {'id': 'fin_eff', 'label': 'Production Cost Efficiency', 'value': 96.8, 'unit': '%', 'type': 'gauge', 'icon': '🏭', 'color': '#43a047', 'trend': 'Batch optimization', 'trend_dir': 'up'},
                {'id': 'fin_ctrl', 'label': 'Expense Control', 'value': 44.50, 'unit': '$/unit', 'type': 'trend', 'icon': '✂️', 'color': '#8e24aa', 'trend': '-4% OpEx', 'trend_dir': 'up'},
                {'id': 'fin_pro', 'label': 'Gross Profit Margin', 'value': 18.4, 'unit': '%', 'type': 'bar', 'icon': '📈', 'color': '#1e88e5', 'trend': 'Core SKU lift', 'trend_dir': 'up'}
            ]

    elif department == 'pm':
        label_res = 'Resource Utilization' if domain != 'manufacturing' else 'Output Efficiency'
        type_res = 'heatmap' if domain != 'manufacturing' else 'bar'
        return [
            {'id': 'pm_comp', 'label': 'Project Completion Rate', 'value': 88.5, 'unit': '%', 'type': 'progress', 'icon': '✅', 'color': '#43a047', 'trend': 'Quarterly', 'trend_dir': 'up'},
            {'id': 'pm_adh', 'label': 'Budget Adherence', 'value': 97.2, 'unit': '%', 'type': 'line', 'icon': '💰', 'color': '#8e24aa', 'trend': 'Global avg', 'trend_dir': 'neutral'},
            {'id': 'pm_util', 'label': label_res, 'value': 91.4, 'unit': '%', 'type': type_res, 'icon': '⚡', 'color': '#1e88e5', 'trend': 'Optimized', 'trend_dir': 'up'}
        ]

    elif department == 'marketing':
        label_eng = 'Customer Engagement' if domain == 'banking' else ('Patient Engagement' if domain == 'healthcare' else ('Student Engagement' if domain == 'education' else 'Market Reach'))
        type_eng = 'heatmap' if domain != 'manufacturing' else 'map'
        return [
            {'id': 'mkt_rec', 'label': 'Campaign Conversion', 'value': 14.2, 'unit': '%', 'type': 'gauge', 'icon': '📣', 'color': '#1e88e5', 'trend': '+2% shift', 'trend_dir': 'up'},
            {'id': 'mkt_eng', 'label': label_eng, 'value': 64.8, 'unit': '%', 'type': type_eng, 'icon': '📈', 'color': '#8e24aa', 'trend': 'Interactive index', 'trend_dir': 'neutral'},
            {'id': 'mkt_roi', 'label': 'Campaign ROI', 'value': 4.2, 'unit': 'x', 'type': 'chart', 'icon': '💎', 'color': '#43a047', 'trend': 'Attributed rev', 'trend_dir': 'up'}
        ]

    elif department == 'logistics':
        label_turn = 'Inventory Turnover' if domain == 'manufacturing' else 'Inventory Accuracy'
        type_turn = 'line' if domain == 'manufacturing' else 'heatmap'
        if domain == 'banking':
            label_turn = 'Doc Flow Efficiency'
            type_turn = 'line'
            
        return [
            {'id': 'log_turn', 'label': label_turn, 'value': 94.5, 'unit': '%', 'type': type_turn, 'icon': '📦', 'color': '#1e88e5', 'trend': 'SLA target', 'trend_dir': 'neutral'},
            {'id': 'log_del', 'label': 'On-time Delivery', 'value': 98.8, 'unit': '%', 'type': 'heatmap' if domain == 'manufacturing' else 'bar', 'icon': '🚚', 'color': '#43a047', 'trend': 'Last 30 days', 'trend_dir': 'up'},
            {'id': 'log_rel', 'label': 'Supplier Reliability', 'value': 89.2, 'unit': '', 'type': 'gauge', 'icon': '🤝', 'color': '#fb8c00', 'trend': 'Score index', 'trend_dir': 'up'}
        ]

    else: # Operations / Default
        return [
            {'id': 'sys_uptime', 'label': 'System Reliability', 'value': 99.98, 'unit': '%', 'type': 'gauge', 'icon': '⚡', 'color': '#43a047', 'trend': 'Global', 'trend_dir': 'up'},
            {'id': 'sys_risk', 'label': 'Compliance Alerts', 'value': 0, 'unit': 'Critical', 'type': 'checklist', 'icon': '🚨', 'color': '#e53935', 'trend': 'Zero data loss', 'trend_dir': 'neutral'},
            {'id': 'sys_rev', 'label': f'{domain.capitalize()} Performance', 'value': 'Stable', 'unit': '', 'type': 'trend', 'icon': '⚙️', 'color': '#8e24aa', 'trend': 'Monitoring', 'trend_dir': 'neutral'}
        ]


# ──────────────────────────────────────────────────────────────────────────────
# Analytics Data
# ──────────────────────────────────────────────────────────────────────────────

def get_line_chart_data(domain, department):
    metrics = _rows(domain, 'metrics')
    dept_m = sorted(
        [m for m in metrics if m['department'] == department and m['name'] == 'revenue'],
        key=lambda x: x['date'] or ''
    )[-12:]
    labels = [(m.get('period') or m.get('date', '')[:7]) for m in dept_m]
    values = [m['value'] for m in dept_m]
    if not labels:
        # generate synthetic
        now = datetime.now()
        labels = [(now - timedelta(days=30*i)).strftime('%b %Y') for i in range(11, -1, -1)]
        values = [round(random.uniform(60000, 200000), 0) for _ in labels]
    return {'labels': labels, 'datasets': [{'label': 'Revenue', 'data': values}]}


def get_pie_chart_data(domain, department):
    tasks = _rows(domain, 'tasks')
    # Filter tasks where department is either 'from' or 'to'
    dept_tasks = [t for t in tasks if (t.get('from_dept','').lower() == department.lower() or t.get('to_dept','').lower() == department.lower())]
    counts = {}
    for t in dept_tasks:
        s = t.get('status', 'unknown')
        counts[s] = counts.get(s, 0) + 1
    if not counts:
        counts = {'In Progress': 45, 'Completed': 35, 'Delayed': 20}
    return {'labels': list(counts.keys()), 'data': list(counts.values())}


def get_specialized_analytics(domain, department):
    # Specialized interactive data components (Heatmaps, Gauges, Gantt)
    
    if department == 'pm':
        # Gantt Data
        return {
            'type': 'gantt',
            'tasks': [
                {'id': 1, 'name': 'Phase 1: Research', 'start': '2026-04-01', 'end': '2026-04-10', 'progress': 100},
                {'id': 2, 'name': 'Phase 2: Development', 'start': '2026-04-11', 'end': '2026-05-15', 'progress': 45},
                {'id': 3, 'name': 'Phase 3: Testing', 'start': '2026-05-16', 'end': '2026-06-01', 'progress': 0}
            ]
        }
    
    if 'accuracy' in str(department).lower() or department == 'logistics' or domain == 'healthcare':
        # Heatmap Data
        return {
            'type': 'heatmap',
            'data': [[random.randint(0, 100) for _ in range(7)] for _ in range(5)],
            'labels_x': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            'labels_y': ['North', 'South', 'East', 'West', 'Central']
        }
    
    return {'type': 'generic', 'status': 'No specialized override'}



def get_heatmap_data(domain, department):
    """Returns 7x24 activity matrix (days × hours)."""
    tasks = _rows(domain, 'tasks')
    matrix = [[random.randint(0, 10) for _ in range(24)] for _ in range(7)]
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return {'days': days, 'matrix': matrix}


def get_goal_progress(domain, department):
    kpis = _rows(domain, 'kpis')
    dept_kpis = [k for k in kpis if k['department'] == department]
    result = []
    for k in dept_kpis[:6]:
        target = k.get('target') or 100
        actual = k.get('actual') or 0
        pct = min(round(actual / target * 100), 100) if target else 0
        result.append({
            'name': k['name'],
            'target': target,
            'actual': actual,
            'unit': k.get('unit', ''),
            'pct': pct,
            'status': k.get('status', 'neutral')
        })
    if not result:
        result = [
            {'name': 'Revenue Target', 'target': 100, 'actual': 78, 'unit': '%', 'pct': 78, 'status': 'on-track'},
            {'name': 'Customer Satisfaction', 'target': 90, 'actual': 85, 'unit': 'score', 'pct': 94, 'status': 'on-track'},
            {'name': 'Task Completion', 'target': 80, 'actual': 65, 'unit': '%', 'pct': 81, 'status': 'at-risk'},
        ]
    return result


def get_kmeans_3d_data(domain, department):
    """Generate 3D cluster data for visualization."""
    employees = _rows(domain, 'employees')
    dept_emps = [e for e in employees if e['department'] == department]
    points = []
    k = 3
    centers = [(random.uniform(20, 80), random.uniform(20, 80), random.uniform(20, 80)) for _ in range(k)]
    for i, e in enumerate(dept_emps[:50]):
        cluster = i % k
        cx, cy, cz = centers[cluster]
        points.append({
            'x': round(cx + random.gauss(0, 8), 2),
            'y': round(cy + random.gauss(0, 8), 2),
            'z': round(cz + random.gauss(0, 8), 2),
            'cluster': cluster,
            'label': e.get('name', f'Emp {i}')
        })
    if not points:
        for i in range(30):
            points.append({
                'x': round(random.gauss(50, 15), 2),
                'y': round(random.gauss(50, 15), 2),
                'z': round(random.gauss(50, 15), 2),
                'cluster': i % 3,
                'label': f'Point {i}'
            })
    return {'points': points, 'k': k}


def get_ball_chart_data(domain, department):
    """KPI ball chart — value drives sphere size."""
    kpis = _rows(domain, 'kpis')
    dept_kpis = [k for k in kpis if k['department'] == department]
    balls = []
    for k in dept_kpis[:8]:
        actual = k.get('actual') or random.uniform(40, 100)
        target = k.get('target') or 100
        balls.append({
            'name': k['name'],
            'value': actual,
            'target': target,
            'radius': max(20, min(60, actual * 0.6)),
            'color': '#43a047' if actual >= target * 0.9 else '#e53935'
        })
    if not balls:
        for name in ['Efficiency', 'Quality', 'Speed', 'Accuracy']:
            v = random.uniform(50, 100)
            balls.append({'name': name, 'value': round(v), 'target': 100,
                          'radius': max(20, min(60, v * 0.6)), 'color': '#1a73e8'})
    return {'balls': balls}


# ──────────────────────────────────────────────────────────────────────────────
# AI Engine — DSS, Decision Analysis, What-If, Scenario
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_KPI_KB = {
    "Efficiency": {
        "definition": "Measures how effectively resources are used to complete tasks or generate revenue.",
        "purpose": "Helps identify operational bottlenecks and minimize wasted time or resources.",
        "formula": "(Output / Input) × 100",
        "data_source": "Workflows, Tasks, Resource Logs"
    },
    "Quality": {
        "definition": "The standard of something as measured against other things of a similar kind.",
        "purpose": "Ensures customer satisfaction and reduces rework or error-correction costs.",
        "formula": "100 - ((Defects / Total Units) × 100)",
        "data_source": "QA Logs, Incidents, Deliverables"
    },
    "Speed": {
        "definition": "The rate at which workflows, tasks, or transactions are completed.",
        "purpose": "Aids in forecasting completion times and improving responsiveness.",
        "formula": "Total Tasks Completed / Time Period",
        "data_source": "Workflow Durations, Timestamps"
    },
    "Goal Completion": {
        "definition": "The percentage of assigned goals or tasks successfully finished in a period.",
        "purpose": "Tracks departmental momentum and personal accountability.",
        "formula": "(Completed Tasks / Total Assigned Tasks) × 100",
        "data_source": "Tasks Table"
    },
    "Default": {
        "definition": "A standard performance metric tracking organizational health.",
        "purpose": "Used to gauge relative operational trends over time.",
        "formula": "Calculated by the data aggregation engine.",
        "data_source": "General Database Aggregation"
    }
}

class AuraAI:
    def __init__(self, domain, department=None, role='admin', user_id=None):
        self.domain = domain
        self.department = department
        self.role = role
        self.user_id = user_id

    def _load_context(self):
        ctx = {}
        for tbl in ['employees', 'tasks', 'kpis', 'transactions', 'invoices',
                    'projects', 'customers', 'leads', 'deals', 'decisions']:
            try:
                rows, _ = get_records(self.domain, tbl, limit=100)
                ctx[tbl] = rows
            except Exception:
                ctx[tbl] = []
                
        # Load Isolated Learning Profile
        if self.user_id:
            from database.db_manager import get_conn, ensure_learning_schema
            conn = get_conn(self.domain)
            try:
                ensure_learning_schema(conn)
                prof = conn.execute("SELECT * FROM user_ai_profiles WHERE user_id=?", (self.user_id,)).fetchone()
                logs = conn.execute("SELECT * FROM user_action_logs WHERE user_id=? ORDER BY timestamp DESC LIMIT 50", (self.user_id,)).fetchall()
                ctx['user_profile'] = dict(prof) if prof else None
                ctx['user_logs'] = [dict(l) for l in logs] if logs else []
            except Exception:
                ctx['user_profile'] = None
                ctx['user_logs'] = []
            finally:
                conn.close()
                
        return ctx

    def simulate_what_if(self, variable, change_pct):
        # Professional simulation engine
        impact_map = {
            'headcount': {'revenue': 0.8, 'expenses': 1.2, 'efficiency': -0.1},
            'marketing_spend': {'lead_gen': 1.5, 'revenue': 0.6, 'expenses': 1.0},
            'production_speed': {'output': 1.1, 'safety_risk': 1.4, 'wear_and_tear': 1.8}
        }
        
        impacts = impact_map.get(variable, {'general_productivity': 0.5})
        results = []
        for metric, multi in impacts.items():
            shift = change_pct * multi
            results.append({
                'metric': metric.replace('_', ' ').capitalize(),
                'original': 'Current Baseline',
                'projected': f"{shift:+.1f}% shift expected",
                'risk': 'High' if shift > 50 or shift < -50 else 'Moderate'
            })
        return results

    def _decision_support(self, query):
        decisions = _rows(self.domain, 'decisions')
        relevant = [d for d in decisions if self.department in d.get('department', '')]
        
        history_str = "\n".join([f"- {d['title']}: {d['outcome']} (Score: {d['success_score']})" for d in relevant[:3]])
        
        return f"""
        ### 🧠 AI Decision Support ({self.domain.capitalize()} / {self.department.upper()})
        
        **Historical Analysis:**
        {history_str if relevant else "No localized decision history found for this domain yet."}
        
        **Proposed Action Plan:**
        Based on current {self.domain} trends, I recommend optimizing the {self.department} workflow by 12% via predictive resource reallocation.
        
        **Probabilities of Success:**
        1. Automated Routing: 88%
        2. Manual Oversight: 64%
        3. Hybrid Model: 92% (Recommended)
        """

    def chat(self, message, history=None):
        msg_l = message.lower()
        
        if 'what if' in msg_l or 'simulate' in msg_l:
            return "### 🧪 Scenario Simulation Engine\nI am ready to perform a What-If analysis. Please specify a variable (e.g., 'What if we increase headcount by 10%')."
        
        if 'decision' in msg_l or 'recommend' in msg_l:
            return self._decision_support(message)
            
        # Default specialized domain prompt
        prompt = f"I am the Aura AI Agent for the {self.domain} {self.department} department. How can I assist you with your professional oversight today?"
        return f"{prompt}\n\nI have access to your departmental KPIs and can provide real-time alerts or analyze historical domain decisions."

    def suggest_contacts(self, intent: str):
        """AI-Powered Smart Contact Suggestion Engine"""
        intent = intent.lower()
        
        # 1. NLP Simple Intent Matching -> Department Mapping
        target_dept = 'general'
        if any(w in intent for w in ['hire', 'payroll', 'employee', 'leave', 'vacation', 'hr']):
            target_dept = 'hr'
        elif any(w in intent for w in ['money', 'invoice', 'budget', 'expense', 'finance']):
            target_dept = 'finance'
        elif any(w in intent for w in ['system', 'bug', 'crash', 'it']):
            target_dept = 'it'
        elif any(w in intent for w in ['task', 'workflow', 'delay', 'issue']):
            target_dept = self.department  # Route to their own department managers
            
        # 2. Fetch users in the target department
        from database.db_manager import get_conn, ensure_learning_schema
        conn = get_conn(self.domain)
        try:
            ensure_learning_schema(conn)
            # Users with presence
            users = conn.execute("""
                SELECT u.id, u.name, u.role, u.department, COALESCE(cs.status, 'offline') as presence 
                FROM users u 
                LEFT JOIN comm_status cs ON u.id = cs.user_id 
                WHERE u.department = ? OR u.role = 'admin'
            """, (target_dept,)).fetchall()
            
            # Scope limitation: non-admins only see target_dept
            if self.role != 'admin' and self.role != 'manager':
                users = [u for u in users if u['department'] == target_dept]
                
            scored_candidates = []
            for u in users:
                if u['id'] == self.user_id: continue
                # Base score via Presence
                score = 100 if u['presence'] == 'online' else (70 if u['presence'] == 'away' else (40 if u['presence'] == 'busy' else 10))
                
                # Expertise/Role weight
                if u['role'] == 'manager': score += 20
                if u['role'] == 'admin': score += 30
                
                # Historical Learning Weight
                past_acceptance = conn.execute(
                    "SELECT COUNT(*) FROM contact_suggestions_log WHERE user_id=? AND suggested_user_id=? AND was_accepted=1", 
                    (self.user_id, u['id'])
                ).fetchone()[0]
                score += past_acceptance * 15 # Huge boost to people they usually accept
                
                scored_candidates.append({
                    'id': u['id'], 'name': u['name'], 'role': u['role'], 'department': u['department'],
                    'status': u['presence'], 'score': score
                })
                
            # Sort top 3
            scored_candidates.sort(key=lambda x: x['score'], reverse=True)
            top_3 = scored_candidates[:3]
            
            confidence = "High" if (top_3 and top_3[0]['score'] > 90) else "Medium"
            
            return {
                'department_identified': target_dept,
                'confidence': confidence,
                'candidates': top_3
            }
        except Exception as e:
            return {'error': str(e), 'candidates': []}
        finally:
            conn.close()

    def explain_kpi(self, kpi_name: str, value: str = None, trend: str = None, lang: str = 'en'):
        """Interactive KPI Explanation Module logic."""
        from database.db_manager import get_conn, ensure_kpi_schema
        
        # 1. Search DB for Admin override
        conn = get_conn(self.domain)
        kpi_data = None
        try:
            ensure_kpi_schema(conn)
            row = conn.execute("SELECT * FROM kpi_definitions WHERE name LIKE ?", (f"%{kpi_name}%",)).fetchone()
            if row:
                kpi_data = dict(row)
        except Exception:
            pass
        finally:
            conn.close()
            
        # 2. Fallback to Local Knowledge Base
        if not kpi_data:
            matched_key = "Default"
            for k in DEFAULT_KPI_KB.keys():
                if k.lower() in kpi_name.lower():
                    matched_key = k
                    break
            
            kpi_data = DEFAULT_KPI_KB[matched_key]
            kpi_data['name'] = kpi_name # Keep requested name
            
        # 3. Dynamic Contextual AI Insight
        insight = "The data indicates stable operational patterns."
        if value:
            # Simple heuristic Insight Generator based on role
            val_clean = float(''.join(c for c in str(value) if c.isdigit() or c=='.') or 0)
            
            if self.role == 'admin' or self.role == 'manager':
                insight = f"Strategic View: The current value of {value} reflects operational throughput. "
                if val_clean > 80:
                    insight += "This is within optimal high-performance bounds, suggesting scalable stability. "
                else:
                    insight += "There is notable room for process optimization. "
            else:
                insight = f"Operational View: Right now, we are at {value}. "
                if val_clean > 80:
                    insight += "Great job, your team is performing above average and hitting targets! "
                else:
                    insight += "This indicates we might be moving a little slower than planned. "
                    
            if trend and 'up' in trend.lower():
                insight += "The upward trend is a positive indicator of recent changes."
            elif trend and 'down' in trend.lower():
                insight += "The downward trend should be monitored for potential risks."

        # Support bilingual output gracefully (simple simulation)
        if lang == 'ar':
            insight = "هذه البيانات تعكس مستوى الأداء الحالي. " + ("استمر في العمل الجيد!" if val_clean > 80 else "هناك مجال للتحسين.")

        return {
            'kpi_name': kpi_data.get('name', kpi_name),
            'definition': kpi_data.get('definition', ''),
            'purpose': kpi_data.get('purpose', ''),
            'formula': kpi_data.get('formula', ''),
            'data_source': kpi_data.get('data_source', ''),
            'ai_insight': insight
        }

    # ── Intent Parser ──────────────────────────────────────────────────────────

    def parse_intent(self, message: str):
        msg = message.lower().strip()
        intents = [
            (['show', 'list', 'get', 'display', 'view'],       'query'),
            (['create', 'add', 'new', 'insert'],                'create'),
            (['update', 'edit', 'change', 'modify'],            'update'),
            (['delete', 'remove', 'archive'],                    'delete'),
            (['what if', 'simulate', 'predict', 'forecast'],    'whatif'),
            (['compare', 'scenario', 'best case', 'worst'],     'scenario'),
            (['decide', 'decision', 'recommend', 'suggest'],    'dss'),
            (['analyze', 'analyse', 'analysis', 'insight'],     'analyze'),
            (['help', 'how', 'guide', 'tutorial', 'explain'],   'help'),
            (['report', 'summary', 'overview'],                  'report'),
            (['chart', 'graph', 'visualize', 'plot'],           'chart'),
        ]
        for keywords, intent in intents:
            if any(k in msg for k in keywords):
                return intent
        return 'general'

    # ── Main Chat Handler ──────────────────────────────────────────────────────

    def chat(self, message: str, history=None):
        intent = self.parse_intent(message)
        ctx = self._load_context()
        msg_low = message.lower()

        if intent == 'whatif':
            return self._what_if_analysis(message, ctx)
        elif intent == 'scenario':
            return self._scenario_analysis(message, ctx)
        elif intent == 'dss':
            return self._dss_engine(message, ctx)
        elif intent == 'analyze':
            return self._deep_analysis(message, ctx)
        elif intent == 'report':
            return self._generate_report(ctx)
        elif intent == 'help':
            return self._help_response(message)
        elif 'employee' in msg_low or 'hr' in msg_low or 'staff' in msg_low:
            return self._hr_analysis(ctx)
        elif 'revenue' in msg_low or 'finance' in msg_low or 'budget' in msg_low:
            return self._finance_analysis(ctx)
        elif 'task' in msg_low or 'operation' in msg_low or 'project' in msg_low:
            return self._ops_analysis(ctx)
        elif 'customer' in msg_low or 'crm' in msg_low or 'lead' in msg_low:
            return self._crm_analysis(ctx)
        elif 'kpi' in msg_low or 'performance' in msg_low or 'metric' in msg_low:
            return self._kpi_analysis(ctx)
        else:
            return self._general_response(message, ctx)

    # ── Analysis Functions ─────────────────────────────────────────────────────

    def _hr_analysis(self, ctx):
        emps = ctx.get('employees', [])
        active = [e for e in emps if e.get('status') == 'active']
        on_leave = [e for e in emps if e.get('status') == 'on-leave']
        avg_sal = _avg([e.get('salary', 0) for e in active])
        dept_counts = {}
        for e in emps:
            d = e.get('department', 'Unknown')
            dept_counts[d] = dept_counts.get(d, 0) + 1
        top_dept = max(dept_counts, key=dept_counts.get) if dept_counts else 'N/A'

        return {
            'type': 'analysis',
            'title': '👥 HR Analysis',
            'summary': f"Your organization has **{len(active)} active employees** across {len(dept_counts)} departments. "
                       f"Average salary is **${avg_sal:,.0f}**. "
                       f"**{len(on_leave)} employees** are currently on leave.",
            'insights': [
                f"🏆 Largest department: **{top_dept}** ({dept_counts.get(top_dept, 0)} employees)",
                f"💰 Average salary: **${avg_sal:,.0f}** per year",
                f"📊 Active workforce: **{len(active)}/{len(emps)}** ({round(len(active)/len(emps)*100) if emps else 0}%)",
                f"🌴 On leave: **{len(on_leave)}** employees ({round(len(on_leave)/len(emps)*100) if emps else 0}%)",
            ],
            'recommendations': [
                "Consider cross-training programs for departments with single points of failure.",
                "Review compensation bands for cost optimization.",
                "Implement automated leave tracking to improve workforce planning.",
            ],
            'data': {'dept_counts': dept_counts, 'avg_salary': avg_sal}
        }

    def _finance_analysis(self, ctx):
        txns = ctx.get('transactions', [])
        invoices = ctx.get('invoices', [])
        budgets = ctx.get('budgets', [])
        total_revenue = sum(t.get('amount', 0) for t in txns if t.get('type') == 'credit')
        total_expense = abs(sum(t.get('amount', 0) for t in txns if t.get('type') == 'debit'))
        pending_inv = [i for i in invoices if i.get('status') == 'pending']
        overdue_inv = [i for i in invoices if i.get('status') == 'overdue']
        pending_value = sum(i.get('total', 0) for i in pending_inv)
        overdue_value = sum(i.get('total', 0) for i in overdue_inv)
        budget_usage = _avg([b.get('spent', 0) / b.get('allocated', 1) * 100 for b in budgets]) if budgets else 0

        return {
            'type': 'analysis',
            'title': '💰 Financial Analysis',
            'summary': f"Total revenue recorded: **${total_revenue:,.0f}**. "
                       f"Total expenses: **${total_expense:,.0f}**. "
                       f"Net position: **${total_revenue - total_expense:,.0f}**.",
            'insights': [
                f"📥 Pending invoices: **{len(pending_inv)}** worth **${pending_value:,.0f}**",
                f"⚠️ Overdue invoices: **{len(overdue_inv)}** worth **${overdue_value:,.0f}**",
                f"📊 Budget utilization: **{budget_usage:.1f}%** average",
                f"💸 Expense ratio: **{round(total_expense/total_revenue*100) if total_revenue else 0}%** of revenue",
            ],
            'recommendations': [
                f"{'⚠️ High' if budget_usage > 80 else '✅ Normal'} budget utilization — review discretionary spending.",
                "Follow up on overdue invoices to improve cash flow.",
                "Consider automated payment reminders for pending invoices.",
            ],
            'data': {'revenue': total_revenue, 'expenses': total_expense, 'budget_usage': budget_usage}
        }

    def _ops_analysis(self, ctx):
        tasks = ctx.get('tasks', [])
        projects = ctx.get('projects', [])
        done = len([t for t in tasks if t.get('status') == 'done'])
        in_prog = len([t for t in tasks if t.get('status') == 'in-progress'])
        critical = len([t for t in tasks if t.get('priority') == 'critical'])
        completion_rate = round(done / len(tasks) * 100) if tasks else 0
        active_proj = len([p for p in projects if p.get('status') == 'active'])
        avg_completion = _avg([p.get('completion', 0) for p in projects])

        return {
            'type': 'analysis',
            'title': '⚙️ Operations Analysis',
            'summary': f"**{completion_rate}%** task completion rate. "
                       f"**{in_prog}** tasks in progress. "
                       f"**{active_proj}** active projects averaging **{avg_completion:.0f}%** completion.",
            'insights': [
                f"✅ Completed tasks: **{done}/{len(tasks)}**",
                f"🔄 In-progress tasks: **{in_prog}**",
                f"🚨 Critical priority tasks: **{critical}** — need immediate attention",
                f"📁 Active projects: **{active_proj}** with avg **{avg_completion:.0f}%** done",
            ],
            'recommendations': [
                "Reassign resources from low-priority tasks to critical items.",
                "Daily standup for in-progress tasks will accelerate completion.",
                "Review project milestones — some may need timeline adjustment.",
            ],
            'data': {'completion_rate': completion_rate, 'critical_tasks': critical}
        }

    def _crm_analysis(self, ctx):
        customers = ctx.get('customers', [])
        leads = ctx.get('leads', [])
        deals = ctx.get('deals', [])
        active_cust = [c for c in customers if c.get('status') == 'active']
        total_value = sum(c.get('value', 0) for c in customers)
        qualified = [l for l in leads if l.get('status') == 'qualified']
        won_deals = [d for d in deals if d.get('stage') == 'closed-won']
        total_deal_value = sum(d.get('value', 0) for d in won_deals)
        conv_rate = round(len(won_deals) / len(deals) * 100) if deals else 0

        return {
            'type': 'analysis',
            'title': '🤝 CRM Analysis',
            'summary': f"**{len(active_cust)} active customers** with total portfolio value of **${total_value:,.0f}**. "
                       f"Deal conversion rate: **{conv_rate}%**.",
            'insights': [
                f"👥 Active customers: **{len(active_cust)}/{len(customers)}**",
                f"💎 Portfolio value: **${total_value:,.0f}**",
                f"🎯 Qualified leads: **{len(qualified)}/{len(leads)}**",
                f"🏆 Won deals value: **${total_deal_value:,.0f}** ({conv_rate}% rate)",
            ],
            'recommendations': [
                "Focus sales efforts on the top 20% of customers generating 80% of value.",
                f"Lead conversion at {conv_rate}% — {'above' if conv_rate > 20 else 'below'} industry average.",
                "Implement automated nurture sequences for qualified leads.",
            ],
            'data': {'conversion_rate': conv_rate, 'total_value': total_value}
        }

    def _kpi_analysis(self, ctx):
        kpis = ctx.get('kpis', [])
        on_track = [k for k in kpis if k.get('status') == 'on-track']
        at_risk = [k for k in kpis if k.get('status') == 'at-risk']
        avg_performance = _avg([min(k.get('actual', 0) / k.get('target', 1) * 100, 150) for k in kpis])

        return {
            'type': 'analysis',
            'title': '🎯 KPI Performance Analysis',
            'summary': f"Overall KPI health: **{avg_performance:.0f}%** of targets achieved. "
                       f"**{len(on_track)}** KPIs on track, **{len(at_risk)}** need attention.",
            'insights': [
                f"✅ On-track KPIs: **{len(on_track)}** — {[k['name'] for k in on_track[:3]]}",
                f"⚠️ At-risk KPIs: **{len(at_risk)}** — {[k['name'] for k in at_risk[:3]]}",
                f"📊 Average performance: **{avg_performance:.1f}%** of targets",
                f"📈 Best performer: **{max(kpis, key=lambda k: (k.get('actual',0)/k.get('target',1)), default={}).get('name','N/A')}**",
            ],
            'recommendations': [
                "Deep dive into at-risk KPIs to identify root causes.",
                "Celebrate and document strategies behind on-track KPIs.",
                "Consider revising unrealistic targets vs. genuine underperformance.",
            ],
            'data': {'on_track': len(on_track), 'at_risk': len(at_risk), 'avg_performance': avg_performance}
        }

    def _what_if_analysis(self, message, ctx):
        msg = message.lower()
        # Extract a percentage if mentioned
        import re
        pct_match = re.search(r'(\d+)\s*%', msg)
        pct = int(pct_match.group(1)) if pct_match else 15

        txns = ctx.get('transactions', [])
        current_rev = sum(t.get('amount', 0) for t in txns if t.get('type') == 'credit')
        if current_rev == 0:
            current_rev = 250000

        scenarios = []
        for factor in [1 + pct/100, 1 + pct/200, 1]:
            new_rev = current_rev * factor
            new_expense = current_rev * 0.65 + (new_rev - current_rev) * 0.45
            new_profit = new_rev - new_expense
            scenarios.append({
                'label': f"+{round((factor-1)*100)}% Revenue" if factor > 1 else "Current",
                'revenue': round(new_rev),
                'expenses': round(new_expense),
                'profit': round(new_profit),
                'margin': round(new_profit / new_rev * 100, 1) if new_rev else 0
            })

        return {
            'type': 'whatif',
            'title': f'🔮 What-If Analysis (+{pct}% Revenue)',
            'summary': f"Simulating a **{pct}% revenue increase** from current baseline of **${current_rev:,.0f}**.",
            'scenarios': scenarios,
            'insights': [
                f"📈 New projected revenue: **${scenarios[0]['revenue']:,.0f}**",
                f"💰 Projected profit: **${scenarios[0]['profit']:,.0f}**",
                f"📊 Profit margin: **{scenarios[0]['margin']}%**",
                f"⚡ This assumes incremental costs of **{45}%** on new revenue",
            ],
            'recommendation': f"A {pct}% revenue increase is {'highly achievable' if pct <= 15 else 'ambitious but possible' if pct <= 30 else 'very aggressive'} "
                              f"based on historical trends. Recommend phasing growth over 2–3 quarters."
        }

    def _scenario_analysis(self, message, ctx):
        txns = ctx.get('transactions', [])
        base_rev = sum(t.get('amount', 0) for t in txns if t.get('type') == 'credit') or 250000
        base_cost = base_rev * 0.65

        scenarios = [
            {
                'name': '🌟 Best Case',
                'color': '#43a047',
                'probability': '25%',
                'revenue': round(base_rev * 1.25),
                'costs': round(base_cost * 1.10),
                'profit': round(base_rev * 1.25 - base_cost * 1.10),
                'assumptions': ['Market conditions favorable', 'All KPIs exceed targets', 'No major incidents']
            },
            {
                'name': '📊 Expected Case',
                'color': '#1e88e5',
                'probability': '55%',
                'revenue': round(base_rev * 1.08),
                'costs': round(base_cost * 1.05),
                'profit': round(base_rev * 1.08 - base_cost * 1.05),
                'assumptions': ['Moderate growth', 'Normal operations', 'Minor disruptions expected']
            },
            {
                'name': '⚠️ Worst Case',
                'color': '#e53935',
                'probability': '20%',
                'revenue': round(base_rev * 0.85),
                'costs': round(base_cost * 1.15),
                'profit': round(base_rev * 0.85 - base_cost * 1.15),
                'assumptions': ['Market downturn', 'Increased competition', 'Operational disruptions']
            },
        ]

        return {
            'type': 'scenario',
            'title': '📐 Scenario Analysis',
            'summary': "Three-scenario projection based on current data and historical patterns.",
            'scenarios': scenarios,
            'recommendation': "Focus on the Expected Case for planning. Build buffers for the Worst Case. "
                              "Invest incrementally to capitalize on Best Case opportunities."
        }

    def _dss_engine(self, message, ctx):
        """Decision Support System — proposes decisions with probabilities."""
        emps = ctx.get('employees', [])
        tasks = ctx.get('tasks', [])
        budgets = ctx.get('budgets', [])
        kpis = ctx.get('kpis', [])
        decisions_hist = ctx.get('decisions', [])

        # Analyze context to pick relevant decisions
        overdue_tasks = len([t for t in tasks if t.get('status') not in ('done',)])
        budget_stress = any(b.get('spent', 0) > b.get('allocated', 1) * 0.85 for b in budgets)
        at_risk_kpis = [k for k in kpis if k.get('status') == 'at-risk']

        options = []
        if overdue_tasks > 5:
            options.append({
                'title': 'Reassign overdue tasks to available team members',
                'impact': 'Task completion rate +15%',
                'effort': 'Low',
                'success_prob': 84,
                'risk': 'Team capacity constraints',
                'timeframe': '1-2 weeks'
            })
        if budget_stress:
            options.append({
                'title': 'Freeze discretionary spending for Q2',
                'impact': 'Cost reduction 10-15%',
                'effort': 'Medium',
                'success_prob': 76,
                'risk': 'Team morale impact',
                'timeframe': '3 months'
            })
        if at_risk_kpis:
            options.append({
                'title': f'Launch targeted recovery plan for {at_risk_kpis[0]["name"]}',
                'impact': 'KPI improvement 10-20%',
                'effort': 'High',
                'success_prob': 68,
                'risk': 'Requires dedicated resources',
                'timeframe': '4-6 weeks'
            })
        # Always add a general improvement option
        options.append({
            'title': 'Implement automated reporting for all KPIs',
            'impact': 'Decision speed +40%, Manual work -60%',
            'effort': 'Medium',
            'success_prob': 92,
            'risk': 'Initial setup time',
            'timeframe': '2-3 weeks'
        })

        # Historical pattern generic
        past_positive = [d for d in decisions_hist if d.get('outcome') == 'positive']
        avg_success = _avg([d.get('success_score', 0.5) for d in past_positive])
        
        recom_str = f"The highest-confidence option is: **\"{options[0]['title']}\"** with **{options[0]['success_prob']}%** estimated success probability."

        # User Experience Learning Engine integration
        user_logs = ctx.get('user_logs', [])
        if user_logs:
            # Find related past actions
            successful_logs = [l for l in user_logs if l.get('outcome') == 'success']
            if successful_logs:
                recom_str += f"\n\n**Personalized Insight (Based on your experience):** Based on your {len(successful_logs)} successful past actions, your workflow suggests you excel when taking immediate, hands-on approaches rather than delegating."

        return {
            'type': 'dss',
            'title': '🧠 Decision Support System',
            'summary': f"Based on analysis of **{len(emps)} employees**, **{len(tasks)} tasks**, "
                       f"and **{len(decisions_hist)} historical decisions** (avg success rate: **{avg_success*100:.0f}%**).",
            'options': options,
            'historical_note': f"Your team has made **{len(decisions_hist)}** tracked decisions. "
                               f"**{len(past_positive)}** had positive outcomes.",
            'recommendation': recom_str
        }

    def _deep_analysis(self, message, ctx):
        hr = self._hr_analysis(ctx)
        fin = self._finance_analysis(ctx)
        ops = self._ops_analysis(ctx)
        return {
            'type': 'full_analysis',
            'title': '🔬 Full Enterprise Analysis',
            'summary': 'Comprehensive cross-departmental intelligence report.',
            'sections': [hr, fin, ops],
            'overall_health': random.randint(68, 92),
            'priority_actions': [
                "Address at-risk KPIs immediately",
                "Follow up on overdue invoices",
                "Resolve critical priority tasks",
                "Review budget allocations for Q2",
            ]
        }

    def _generate_report(self, ctx):
        kpi_resp = self._kpi_analysis(ctx)
        fin_resp = self._finance_analysis(ctx)
        return {
            'type': 'report',
            'title': '📋 Executive Summary Report',
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'kpis': kpi_resp,
            'finance': fin_resp,
            'summary': (
                "This automated report consolidates key performance indicators, "
                "financial health metrics, and operational status across all departments."
            )
        }

    def _help_response(self, message):
        return {
            'type': 'help',
            'title': '🤖 Aura AI — How Can I Help?',
            'summary': 'I am your intelligent enterprise assistant. Here is what I can do:',
            'capabilities': [
                {'icon': '📊', 'action': 'Analyze data', 'example': '"Analyze HR performance this month"'},
                {'icon': '🔮', 'action': 'What-If simulation', 'example': '"What if revenue increases by 20%?"'},
                {'icon': '📐', 'action': 'Scenario planning', 'example': '"Compare best and worst case scenarios"'},
                {'icon': '🧠', 'action': 'Decision support', 'example': '"Recommend a decision for cost reduction"'},
                {'icon': '📋', 'action': 'Generate reports', 'example': '"Give me a full operational report"'},
                {'icon': '💰', 'action': 'Finance insights', 'example': '"Analyze our budget and revenue"'},
                {'icon': '👥', 'action': 'HR intelligence', 'example': '"Show me employee performance trends"'},
                {'icon': '🎯', 'action': 'KPI tracking', 'example': '"Which KPIs are at risk?"'},
            ]
        }

    def _general_response(self, message, ctx):
        return {
            'type': 'general',
            'title': '🤖 Aura AI Response',
            'summary': f"I've analyzed your {self.domain} domain data in context of your request.",
            'insights': [
                'Your system has real-time access to all departmental data.',
                'Use specific keywords to trigger deep analysis (e.g., analyze, what-if, compare, decide).',
                'Type **help** to see all available AI capabilities.',
            ],
            'suggestion': "Try: \"Analyze operations\" or \"What if we increase budget by 15%?\" or \"Compare scenarios\""
        }

    def chat(self, message, history=None):
        ctx = self._load_context()
        msg = message.lower()
        
        if 'help' in msg:
            return self._help_response(message)
        if 'what if' in msg or 'simulate' in msg:
            return self._what_if_analysis(message, ctx)
        if 'scenario' in msg or 'compare' in msg:
            return self._scenario_analysis(message, ctx)
        if 'decide' in msg or 'recommend' in msg or 'decision' in msg:
            return self._dss_engine(message, ctx)
        if 'report' in msg:
            return self._generate_report(ctx)
        
        # Branch-specific analysis
        if 'hr' in msg or 'employee' in msg or 'staff' in msg:
            return self._hr_analysis(ctx)
        if 'finance' in msg or 'money' in msg or 'budget' in msg:
            return self._finance_analysis(ctx)
        if 'ops' in msg or 'task' in msg or 'project' in msg:
            return self._ops_analysis(ctx)
        if 'marketing' in msg or 'campaign' in msg or 'roi' in msg:
            return self._crm_analysis(ctx)
        if 'analyze' in msg:
            return self._deep_analysis(message, ctx)
            
        return self._general_response(message, ctx)

# ── Org Chart Generator ────────────────────────────────────────────────────────

def generate_org_chart(domain):
    emps, _ = get_records(domain, 'employees', limit=50)
    nodes = []
    for e in emps:
        nodes.append({
            'id': e['id'],
            'name': e.get('name', 'Unknown'),
            'position': e.get('position', 'Staff'),
            'department': e.get('department', 'General'),
            'manager_id': e.get('manager_id'),
            'email': e.get('email', ''),
        })
    return {'nodes': nodes, 'domain': domain}


# ── ERD Generator ──────────────────────────────────────────────────────────────

def generate_erd(domain):
    from database.db_manager import get_all_tables, get_table_schema
    tables = get_all_tables(domain)
    erd = []
    for tbl in tables:
        schema = get_table_schema(domain, tbl)
        fks = [col for col in schema if col['name'].endswith('_id') and col['name'] != 'id']
        erd.append({
            'table': tbl,
            'columns': [c['name'] for c in schema],
            'foreign_keys': fks
        })
    return erd
