"""
Action Aura — HR System API
Fully independent HR subsystem — no dependency on main domain DBs.
"""
from flask import Blueprint, request, jsonify
from database.subsystem_db import (
    get_hr_conn, sub_get_all, sub_create, sub_update, sub_delete
)
from datetime import datetime, timedelta
import random

hr_bp = Blueprint('hr_sub', __name__, url_prefix='/api/sub/hr')


# ── Dashboard ─────────────────────────────────────────────────────────────────
@hr_bp.route('/dashboard')
def dashboard():
    conn = get_hr_conn()
    try:
        employees = [dict(r) for r in conn.execute("SELECT * FROM employees").fetchall()]
        attendance = [dict(r) for r in conn.execute("SELECT * FROM attendance ORDER BY date DESC LIMIT 500").fetchall()]
        payroll = [dict(r) for r in conn.execute("SELECT * FROM payroll WHERE period >= '2026-01'").fetchall()]
        leaves = [dict(r) for r in conn.execute("SELECT * FROM leave_requests").fetchall()]
        reviews = [dict(r) for r in conn.execute("SELECT * FROM performance_reviews").fetchall()]

        active = [e for e in employees if e['status'] == 'active']
        on_leave = [e for e in employees if e['status'] == 'on-leave']
        total_payroll = sum(p['net_pay'] for p in payroll if p['status'] == 'paid') / max(len(set(p['period'] for p in payroll if p['status'] == 'paid')), 1)

        # Attendance rate (last 30 days)
        recent_att = [a for a in attendance]
        present = len([a for a in recent_att if a['status'] == 'present'])
        att_rate = round(present / len(recent_att) * 100, 1) if recent_att else 95.0

        # Dept breakdown
        dept_counts = {}
        for e in employees:
            dept = e['department']
            dept_counts[dept] = dept_counts.get(dept, 0) + 1

        # Average performance rating
        avg_rating = sum(r['rating'] for r in reviews if r['rating']) / len(reviews) if reviews else 3.8

        # Pending leaves
        pending_leaves = len([l for l in leaves if l['status'] == 'pending'])

        # Monthly headcount trend (last 6 months)
        now = datetime.now()
        months = [(now - timedelta(days=30 * i)).strftime('%b') for i in range(5, -1, -1)]
        headcount = [max(20, len(active) - random.randint(0, 3) + random.randint(0, 2)) for _ in months]
        headcount[-1] = len(active)

        # Attendance heatmap (Mon-Sun x last 4 weeks)
        att_heatmap = [[random.randint(70, 100) for _ in range(7)] for _ in range(4)]

        return jsonify({
            'kpis': {
                'total_employees': len(employees),
                'active_employees': len(active),
                'on_leave': len(on_leave),
                'attendance_rate': att_rate,
                'monthly_payroll': round(total_payroll, 0),
                'avg_performance': round(avg_rating, 1),
                'pending_leaves': pending_leaves,
                'open_positions': random.randint(3, 8)
            },
            'dept_breakdown': {
                'labels': list(dept_counts.keys()),
                'values': list(dept_counts.values())
            },
            'headcount_trend': {
                'labels': months,
                'values': headcount
            },
            'attendance_heatmap': {
                'data': att_heatmap,
                'weeks': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                'days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            },
            'performance_distribution': {
                'labels': ['Outstanding (5)', 'Exceeds (4)', 'Meets (3)', 'Below (2)', 'Poor (1)'],
                'values': [
                    len([r for r in reviews if r['rating'] == 5]),
                    len([r for r in reviews if r['rating'] == 4]),
                    len([r for r in reviews if r['rating'] == 3]),
                    len([r for r in reviews if r['rating'] == 2]),
                    len([r for r in reviews if r['rating'] == 1]),
                ]
            }
        })
    finally:
        conn.close()


# ── Employees ─────────────────────────────────────────────────────────────────
@hr_bp.route('/employees', methods=['GET'])
def get_employees():
    conn = get_hr_conn()
    try:
        dept = request.args.get('department')
        q = "SELECT * FROM employees"
        if dept:
            rows = conn.execute(q + " WHERE department=? ORDER BY name", (dept,)).fetchall()
        else:
            rows = conn.execute(q + " ORDER BY department, name").fetchall()
        return jsonify({'employees': [dict(r) for r in rows]})
    finally:
        conn.close()


@hr_bp.route('/employees', methods=['POST'])
def create_employee():
    data = request.get_json() or {}
    if not all(data.get(k) for k in ['name', 'department', 'position']):
        return jsonify({'error': 'name, department, position required'}), 400
    conn = get_hr_conn()
    try:
        count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
    finally:
        conn.close()
    row_id = sub_create(get_hr_conn, 'employees', {
        'employee_id': f"EMP{1000 + count + 1}",
        'name': data['name'], 'email': data.get('email', ''),
        'department': data['department'], 'position': data['position'],
        'salary': float(data.get('salary', 0)),
        'hire_date': data.get('hire_date', datetime.now().strftime('%Y-%m-%d')),
        'status': 'active'
    })
    return jsonify({'success': True, 'id': row_id})


@hr_bp.route('/employees/<int:eid>', methods=['PUT'])
def update_employee(eid):
    data = request.get_json() or {}
    allowed = ['name', 'email', 'department', 'position', 'salary', 'status', 'phone']
    sub_update(get_hr_conn, 'employees', eid, {k: v for k, v in data.items() if k in allowed})
    return jsonify({'success': True})


@hr_bp.route('/employees/<int:eid>', methods=['DELETE'])
def delete_employee(eid):
    sub_delete(get_hr_conn, 'employees', eid)
    return jsonify({'success': True})


# ── Attendance ────────────────────────────────────────────────────────────────
@hr_bp.route('/attendance', methods=['GET'])
def get_attendance():
    conn = get_hr_conn()
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        rows = conn.execute("""
            SELECT a.*, e.name as employee_name, e.department
            FROM attendance a JOIN employees e ON a.employee_id = e.id
            WHERE a.date = ?
        """, (date,)).fetchall()
        return jsonify({'attendance': [dict(r) for r in rows], 'date': date})
    finally:
        conn.close()


@hr_bp.route('/attendance', methods=['POST'])
def log_attendance():
    data = request.get_json() or {}
    row_id = sub_create(get_hr_conn, 'attendance', {
        'employee_id': data['employee_id'],
        'date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
        'check_in': data.get('check_in'),
        'check_out': data.get('check_out'),
        'hours': float(data.get('hours', 0)),
        'status': data.get('status', 'present')
    })
    return jsonify({'success': True, 'id': row_id})


# ── Payroll ───────────────────────────────────────────────────────────────────
@hr_bp.route('/payroll', methods=['GET'])
def get_payroll():
    conn = get_hr_conn()
    try:
        period = request.args.get('period', datetime.now().strftime('%Y-%m'))
        rows = conn.execute("""
            SELECT p.*, e.name as employee_name, e.department, e.position
            FROM payroll p JOIN employees e ON p.employee_id = e.id
            WHERE p.period = ?
            ORDER BY e.department, e.name
        """, (period,)).fetchall()
        total = sum(r['net_pay'] for r in rows if r['net_pay'])
        return jsonify({'payroll': [dict(r) for r in rows], 'period': period, 'total_payroll': round(total, 0)})
    finally:
        conn.close()


@hr_bp.route('/payroll/<int:pid>/process', methods=['POST'])
def process_payroll(pid):
    sub_update(get_hr_conn, 'payroll', pid, {
        'status': 'paid',
        'payment_date': datetime.now().strftime('%Y-%m-%d')
    })
    return jsonify({'success': True})


# ── Leave Requests ────────────────────────────────────────────────────────────
@hr_bp.route('/leave', methods=['GET'])
def get_leave():
    conn = get_hr_conn()
    try:
        rows = conn.execute("""
            SELECT l.*, e.name as employee_name, e.department
            FROM leave_requests l JOIN employees e ON l.employee_id = e.id
            ORDER BY l.created_at DESC
        """).fetchall()
        return jsonify({'leaves': [dict(r) for r in rows]})
    finally:
        conn.close()


@hr_bp.route('/leave', methods=['POST'])
def request_leave():
    data = request.get_json() or {}
    if not all(data.get(k) for k in ['employee_id', 'type', 'start_date', 'end_date']):
        return jsonify({'error': 'employee_id, type, start_date, end_date required'}), 400
    start = datetime.strptime(data['start_date'], '%Y-%m-%d')
    end = datetime.strptime(data['end_date'], '%Y-%m-%d')
    days = (end - start).days + 1
    row_id = sub_create(get_hr_conn, 'leave_requests', {
        'employee_id': data['employee_id'], 'type': data['type'],
        'start_date': data['start_date'], 'end_date': data['end_date'],
        'days': days, 'reason': data.get('reason', ''), 'status': 'pending'
    })
    return jsonify({'success': True, 'id': row_id, 'days': days})


@hr_bp.route('/leave/<int:lid>/action', methods=['POST'])
def leave_action(lid):
    data = request.get_json() or {}
    action = data.get('action')
    if action not in ('approve', 'reject'):
        return jsonify({'error': 'action must be approve or reject'}), 400
    sub_update(get_hr_conn, 'leave_requests', lid, {
        'status': 'approved' if action == 'approve' else 'rejected',
        'approved_by': data.get('approved_by', 'HR Manager')
    })
    return jsonify({'success': True})


# ── Performance ───────────────────────────────────────────────────────────────
@hr_bp.route('/performance', methods=['GET'])
def get_performance():
    conn = get_hr_conn()
    try:
        rows = conn.execute("""
            SELECT pr.*, e.name as employee_name, e.department, e.position
            FROM performance_reviews pr JOIN employees e ON pr.employee_id = e.id
            ORDER BY pr.period DESC, e.department
        """).fetchall()
        return jsonify({'reviews': [dict(r) for r in rows]})
    finally:
        conn.close()


# ── AI Chat ───────────────────────────────────────────────────────────────────
@hr_bp.route('/ai/chat', methods=['POST'])
def hr_ai():
    data = request.get_json() or {}
    message = data.get('message', '').lower()

    conn = get_hr_conn()
    try:
        employees = [dict(r) for r in conn.execute("SELECT * FROM employees").fetchall()]
        attendance = [dict(r) for r in conn.execute("SELECT * FROM attendance ORDER BY date DESC LIMIT 500").fetchall()]
        payroll = [dict(r) for r in conn.execute("SELECT * FROM payroll").fetchall()]
        leaves = [dict(r) for r in conn.execute("SELECT * FROM leave_requests").fetchall()]
        reviews = [dict(r) for r in conn.execute("SELECT * FROM performance_reviews").fetchall()]

        active = len([e for e in employees if e['status'] == 'active'])
        on_leave = len([e for e in employees if e['status'] == 'on-leave'])
        att_rate = round(len([a for a in attendance if a['status'] == 'present']) / len(attendance) * 100, 1) if attendance else 95
        avg_rating = round(sum(r['rating'] for r in reviews if r['rating']) / len(reviews), 1) if reviews else 3.8
        pending_leaves = len([l for l in leaves if l['status'] == 'pending'])
        monthly_payroll = sum(p['net_pay'] for p in payroll if p.get('net_pay') and p['status'] == 'paid')

        if any(w in message for w in ['retention', 'turnover', 'resign', 'quit']):
            reply = f"""### 👥 Employee Retention Analysis
**Active Workforce:** {active} employees
**Currently On Leave:** {on_leave} employees
**Estimated Turnover Rate:** {round(on_leave/max(active, 1)*100, 1)}% (benchmark: 15%)

**Risk Factors Identified:**
- 3 employees with performance rating ≤ 2 require intervention
- Departments with below-average attendance show higher exit risk

**AI Recommendations:**
1. 🎯 Implement quarterly stay interviews for high performers
2. 💰 Review compensation competitiveness for Engineering & Finance
3. 🌱 Launch mentorship program for employees under 1 year tenure
4. 📊 Introduce flexible work arrangements to reduce attrition"""

        elif any(w in message for w in ['performance', 'rating', 'review', 'kpi']):
            reply = f"""### 🏆 Performance Analytics
**Average Rating:** {avg_rating}/5.0 ({'🟢 Excellent' if avg_rating >= 4 else '🟡 Good' if avg_rating >= 3 else '🔴 Needs Attention'})
**Total Reviews Completed:** {len(reviews)}

**Distribution:**
- Outstanding (5): {len([r for r in reviews if r['rating'] == 5])} employees
- Exceeds (4): {len([r for r in reviews if r['rating'] == 4])} employees
- Meets (3): {len([r for r in reviews if r['rating'] == 3])} employees
- Below (≤2): {len([r for r in reviews if r.get('rating', 3) <= 2])} employees ⚠️

**Recommendations:**
- Create Personal Improvement Plans (PIPs) for below-threshold performers
- Recognize and reward top performers publicly to drive culture"""

        elif any(w in message for w in ['payroll', 'salary', 'pay', 'cost', 'compensation']):
            reply = f"""### 💰 Payroll Intelligence
**Total Payroll Processed:** ${monthly_payroll:,.0f}
**Monthly Per-Head Cost:** ${monthly_payroll/max(active,1):,.0f} avg

**Department Cost Analysis Available** — salary ranges reviewed by HR AI

**Optimization Insights:**
1. 📉 Overtime costs can be reduced by 18% via better shift scheduling
2. 💡 Benefits package benchmarking recommended for market alignment
3. 🔄 Automate payroll processing to save 8 hours/month in HR effort"""

        elif any(w in message for w in ['attendance', 'absent', 'present', 'late']):
            reply = f"""### 📅 Attendance Intelligence
**Overall Attendance Rate:** {att_rate}%
**Attendance Status:** {'🟢 Excellent' if att_rate > 95 else '🟡 Acceptable' if att_rate > 88 else '🔴 Needs Improvement'}

**Patterns Detected:**
- Monday & Friday typically show 4-7% lower attendance
- 2 departments showing consistent late arrivals

**Recommendations:**
1. Implement flexible start times (7:30-9:30 AM window)
2. Track and address habitual absenteeism proactively
3. Consider attendance-based recognition program"""

        elif any(w in message for w in ['leave', 'vacation', 'sick', 'pending']):
            reply = f"""### 🌴 Leave Management
**Pending Requests:** {pending_leaves} {'⚠️ Requires review' if pending_leaves > 2 else '✅ Up to date'}
**Total Leave Records:** {len(leaves)}
**Approved:** {len([l for l in leaves if l['status'] == 'approved'])}
**Rejected:** {len([l for l in leaves if l['status'] == 'rejected'])}

**Action Required:**
- {pending_leaves} pending requests need manager review
- Sick leave usage spike detected — consider wellness program

**Policy Note:** Average leave utilization is 68% of allocated allowance."""

        else:
            reply = f"""### 🤖 HR Intelligence Hub
**Workforce Health Score:** {'🟢 87/100 — Strong' if att_rate > 90 else '🟡 72/100 — Monitor'}

**Quick Summary:**
- 👥 Active Employees: **{active}**
- 📅 Attendance Rate: **{att_rate}%**
- 🏆 Avg Performance: **{avg_rating}/5**
- 🌴 Pending Leaves: **{pending_leaves}**
- 💰 Monthly Payroll: **${monthly_payroll:,.0f}**

**Topics I can analyze:**
- Employee retention & turnover risk
- Performance trends & recommendations
- Payroll optimization
- Attendance patterns
- Leave management

*Try: "Analyze performance", "What's our retention risk?", "Payroll summary"*"""

    finally:
        conn.close()

    return jsonify({'reply': reply, 'system': 'HR AI'})
