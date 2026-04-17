from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn, get_records
import json
from datetime import datetime
from api.intelligence import (
    get_adaptive_kpis, time_series_analysis, detect_anomalies, 
    calculate_clv, churn_prediction, attrition_risk, 
    campaign_roi_analysis, budget_vs_actual, process_mining
)

reports_bp = Blueprint('reports', __name__)

def _domain(): return session.get('domain')
def _user_id(): return session.get('user_id')
def _dept(): return session.get('department')

@reports_bp.route('/templates', methods=['GET'])
@login_required
def get_templates():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM report_templates")
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            try:
                r['sections'] = json.loads(r['sections_json'])
            except:
                r['sections'] = []
        return jsonify({'templates': rows})
    finally:
        conn.close()

@reports_bp.route('/assigned', methods=['GET'])
@login_required
def get_assigned_reports():
    domain = _domain()
    user_id = _user_id()
    user_dept = _dept()
    role = session.get('role')
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if role == 'admin':
            cur.execute("SELECT * FROM reports ORDER BY created_at DESC")
        elif role == 'manager':
            cur.execute("SELECT * FROM reports WHERE assigned_to_dept = ? OR assigned_to_user = ? OR generated_by = ? ORDER BY created_at DESC", (user_dept, user_id, user_id))
        else:
            cur.execute("SELECT * FROM reports WHERE assigned_to_user = ? OR generated_by = ? ORDER BY created_at DESC", (user_id, user_id))
        
        rows = [dict(r) for r in cur.fetchall()]
        return jsonify({'reports': rows})
    finally:
        conn.close()

@reports_bp.route('/generate', methods=['POST'])
@login_required
def generate_report():
    data = request.get_json() or {}
    template_id = data.get('template_id')
    assigned_to_user = data.get('assigned_to_user')
    assigned_to_dept = data.get('assigned_to_dept')
    custom_sections = data.get('sections', []) 
    
    domain = _domain()
    user_id = _user_id()
    user_role = session.get('role')
    user_dept = _dept()
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM report_templates WHERE id = ?", (template_id,))
        template = cur.fetchone()
        if not template:
            return jsonify({'error': 'Template not found'}), 404
        
        t_name = template['name']
        
        # ─── REAL INTELLIGENCE GATHERING ───
        metrics = {}
        ai_insights = {
            "summary": f"Analytical overview of {t_name} for {domain.upper()} domain.",
            "recommendations": ["Review operational data for Q2", "Monitor high-priority tasks"],
            "risk_indicators": []
        }
        
        # 1. Base Metrics from Adaptive KPI Engine
        kpis = get_adaptive_kpis(domain, assigned_to_dept or user_dept, user_role)
        for k in kpis:
            metrics[k['label'].lower().replace(' ', '_')] = k['value']

        # 2. Specific Logic per Template
        if "Performance" in t_name:
            ts = time_series_analysis(domain, assigned_to_dept or user_dept)
            metrics['forecast_value'] = ts['forecast'][0]
            ai_insights['summary'] = f"The {t_name} indicates a {ts['trend']} trend in performance with {ts['r_squared']*100:.1f}% confidence."
        
        elif "Financial" in t_name or "Budget" in t_name:
            bva = budget_vs_actual(domain)
            metrics['total_allocated'] = bva.get('total_allocated', 0)
            metrics['total_spent'] = bva.get('total_spent', 0)
            allocated = bva.get('total_allocated') or 1  # avoid ZeroDivisionError
            utilization = bva.get('total_spent', 0) / allocated * 100
            ai_insights['summary'] = f"Financial audit shows {utilization:.1f}% budget utilization across {len(bva.get('departments', []))} departments."
            if bva.get('over_budget_depts'):
                ai_insights['risk_indicators'].append({"level": "high", "msg": f"Departments over budget: {', '.join(bva['over_budget_depts'])}"})

        elif "Forecast" in t_name or "Prediction" in t_name:
            churn = churn_prediction(domain)
            metrics['at_risk_customers'] = churn['high_risk_count']
            ai_insights['summary'] = "Predictive engine has identified specific risks in customer retention and future revenue trends."
            ai_insights['recommendations'] = ["Initiate outreach to high-risk customers", "Review loyalty program effectiveness"]

        elif "Risk" in t_name or "Anomaly" in t_name:
            anomalies = detect_anomalies(domain, assigned_to_dept or user_dept)
            metrics['anomalies_detected'] = len(anomalies)
            if anomalies:
                ai_insights['risk_indicators'] = [{"level": a['severity'], "msg": f"{a['description']}: {a['value']} ({a['direction']})"} for a in anomalies[:3]]
            ai_insights['summary'] = f"Anomaly detection engine identified {len(anomalies)} irregular patterns in the latest dataset."

        elif "Workflow" in t_name or "Efficiency" in t_name:
            proc = process_mining(domain, assigned_to_dept or user_dept)
            metrics['completion_rate'] = proc['completion_rate']
            metrics['avg_step'] = proc['avg_step_reached']
            ai_insights['summary'] = "Process mining reveals structural bottlenecks in standard operating procedures."
            ai_insights['recommendations'] = proc['insights']

        # Snapshot Payload
        payload = {
            "generated_at": datetime.now().isoformat(),
            "domain": domain,
            "template_name": t_name,
            "sections": custom_sections if custom_sections else json.loads(template['sections_json']),
            "metrics": metrics
        }
        
        # Fallback AI recommendations if empty
        if not ai_insights['recommendations']:
            ai_insights['recommendations'] = ["Optimize resource allocation", "Review latest data trends"]
        
        # 3. Handle Raw Data Table if requested
        if "Raw Data Table" in (custom_sections if custom_sections else []):
            try:
                table_to_dump = 'transactions' if 'Finance' in t_name or 'Sales' in t_name else 'employees'
                rows, _ = get_records(domain, table_to_dump, limit=50)
                payload['raw_data'] = [dict(r) for r in rows]
            except Exception as e:
                payload['raw_data'] = [{"Error": f"Extraction failed: {str(e)}"}]

        cur.execute("""
            INSERT INTO reports (template_id, title, generated_by, assigned_to_user, assigned_to_dept, domain, payload_json, ai_insights_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            template_id, 
            f"{t_name} - {datetime.now().strftime('%b %d, %H:%M')}",
            user_id,
            assigned_to_user,
            assigned_to_dept,
            domain,
            json.dumps(payload),
            json.dumps(ai_insights)
        ))
        conn.commit()
        report_id = cur.lastrowid
        
        # Trigger Notification
        notif_msg = f"New intelligent report '{t_name}' has been assigned to you."
        if assigned_to_user:
            cur.execute("INSERT INTO notifications (user_id, message, type, reference_id) VALUES (?, ?, ?, ?)",
                        (assigned_to_user, notif_msg, 'report', report_id))
        elif assigned_to_dept:
            cur.execute("INSERT INTO notifications (department, message, type, reference_id) VALUES (?, ?, ?, ?)",
                        (assigned_to_dept, f"New dept report: {t_name}", 'report', report_id))
        
        conn.commit()
        return jsonify({'success': True, 'report_id': report_id})
    finally:
        conn.close()

@reports_bp.route('/<int:report_id>', methods=['GET'])
@login_required
def get_report(report_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reports WHERE id = ?", (report_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Report not found'}), 404
        
        report = dict(row)
        report['payload'] = json.loads(report['payload_json'])
        report['ai_insights'] = json.loads(report['ai_insights_json'])
        
        # Update Viewed Status
        if report['status'] == 'pending':
            cur.execute("UPDATE reports SET status = 'viewed' WHERE id = ?", (report_id,))
            conn.commit()
            
        return jsonify({'report': report})
    finally:
        conn.close()
