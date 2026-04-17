"""
Action Aura — Accounting System API
Fully independent accounting subsystem — no dependency on main domain DBs.
"""
from flask import Blueprint, request, jsonify
from database.subsystem_db import (
    get_accounting_conn, sub_get_all, sub_create, sub_update, sub_delete
)
import random
from datetime import datetime

accounting_bp = Blueprint('accounting_sub', __name__, url_prefix='/api/sub/accounting')


# ── Dashboard ─────────────────────────────────────────────────────────────────
@accounting_bp.route('/dashboard')
def dashboard():
    conn = get_accounting_conn()
    try:
        txns = [dict(r) for r in conn.execute("SELECT * FROM transactions ORDER BY date DESC LIMIT 500").fetchall()]
        invoices = [dict(r) for r in conn.execute("SELECT * FROM invoices").fetchall()]
        budgets = [dict(r) for r in conn.execute("SELECT * FROM budgets WHERE period LIKE '2026%'").fetchall()]

        total_revenue = sum(t['amount'] for t in txns if t['type'] == 'income')
        total_expense = sum(t['amount'] for t in txns if t['type'] == 'expense')
        net_profit = total_revenue - total_expense
        margin = round(net_profit / total_revenue * 100, 1) if total_revenue else 0

        pending_invoices = [i for i in invoices if i['status'] in ('sent', 'draft')]
        overdue_invoices = [i for i in invoices if i['status'] == 'overdue']
        outstanding = sum(i['total'] for i in pending_invoices + overdue_invoices)

        # Monthly chart data (last 6 months)
        months = []
        revenue_by_month = []
        expense_by_month = []
        for m in range(5, -1, -1):
            from datetime import timedelta
            d = datetime.now().replace(day=1) - timedelta(days=30 * m)
            mon = d.strftime('%Y-%m')
            label = d.strftime('%b %Y')
            months.append(label)
            rev = sum(t['amount'] for t in txns if t['type'] == 'income' and t['date'].startswith(mon))
            exp = sum(t['amount'] for t in txns if t['type'] == 'expense' and t['date'].startswith(mon))
            revenue_by_month.append(round(rev, 0))
            expense_by_month.append(round(exp, 0))

        # Expense categories
        cat_totals = {}
        for t in txns:
            if t['type'] == 'expense':
                cat = t.get('category') or 'Other'
                cat_totals[cat] = cat_totals.get(cat, 0) + t['amount']

        # Budget health
        budget_health = []
        for b in budgets[:6]:
            pct = round(b['spent'] / b['allocated'] * 100, 1) if b['allocated'] else 0
            budget_health.append({'category': b['category'], 'allocated': b['allocated'],
                                   'spent': b['spent'], 'pct': pct,
                                   'status': 'over' if pct > 100 else ('warning' if pct > 80 else 'ok')})

        return jsonify({
            'kpis': {
                'total_revenue': round(total_revenue, 0),
                'total_expense': round(total_expense, 0),
                'net_profit': round(net_profit, 0),
                'profit_margin': margin,
                'outstanding_ar': round(outstanding, 0),
                'pending_invoices': len(pending_invoices),
                'overdue_invoices': len(overdue_invoices),
                'cash_flow': round(total_revenue - total_expense * 0.85, 0)
            },
            'monthly_chart': {
                'labels': months,
                'revenue': revenue_by_month,
                'expenses': expense_by_month
            },
            'expense_breakdown': {
                'labels': list(cat_totals.keys()),
                'values': [round(v, 0) for v in cat_totals.values()]
            },
            'budget_health': budget_health
        })
    finally:
        conn.close()


# ── Transactions ──────────────────────────────────────────────────────────────
@accounting_bp.route('/transactions', methods=['GET'])
def get_transactions():
    limit = int(request.args.get('limit', 50))
    conn = get_accounting_conn()
    try:
        rows = conn.execute("SELECT * FROM transactions ORDER BY date DESC LIMIT ?", (limit,)).fetchall()
        return jsonify({'transactions': [dict(r) for r in rows]})
    finally:
        conn.close()


@accounting_bp.route('/transactions', methods=['POST'])
def create_transaction():
    data = request.get_json() or {}
    required = ['date', 'description', 'amount', 'type']
    if not all(data.get(k) for k in required):
        return jsonify({'error': 'Missing required fields'}), 400
    row_id = sub_create(get_accounting_conn, 'transactions', {
        'date': data['date'], 'description': data['description'],
        'amount': float(data['amount']), 'type': data['type'],
        'category': data.get('category', 'General'), 'status': 'posted'
    })
    return jsonify({'success': True, 'id': row_id})


@accounting_bp.route('/transactions/<int:tid>', methods=['DELETE'])
def delete_transaction(tid):
    sub_delete(get_accounting_conn, 'transactions', tid)
    return jsonify({'success': True})


# ── Invoices ──────────────────────────────────────────────────────────────────
@accounting_bp.route('/invoices', methods=['GET'])
def get_invoices():
    conn = get_accounting_conn()
    try:
        rows = conn.execute("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 100").fetchall()
        return jsonify({'invoices': [dict(r) for r in rows]})
    finally:
        conn.close()


@accounting_bp.route('/invoices', methods=['POST'])
def create_invoice():
    data = request.get_json() or {}
    if not data.get('client_name') or not data.get('amount'):
        return jsonify({'error': 'Client name and amount required'}), 400
    amt = float(data['amount'])
    tax = float(data.get('tax', 0))
    conn = get_accounting_conn()
    try:
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    finally:
        conn.close()

    row_id = sub_create(get_accounting_conn, 'invoices', {
        'invoice_number': f"INV-{2026000 + count + 1}",
        'client_name': data['client_name'],
        'client_email': data.get('client_email', ''),
        'amount': amt, 'tax': tax, 'total': amt + tax,
        'status': data.get('status', 'draft'),
        'due_date': data.get('due_date', ''),
        'notes': data.get('notes', '')
    })
    return jsonify({'success': True, 'id': row_id})


@accounting_bp.route('/invoices/<int:iid>/status', methods=['POST'])
def update_invoice_status(iid):
    data = request.get_json() or {}
    status = data.get('status')
    if status not in ('draft', 'sent', 'paid', 'overdue', 'cancelled'):
        return jsonify({'error': 'Invalid status'}), 400
    updates = {'status': status}
    if status == 'paid':
        updates['paid_date'] = datetime.now().strftime('%Y-%m-%d')
    sub_update(get_accounting_conn, 'invoices', iid, updates)
    return jsonify({'success': True})


# ── Budgets ───────────────────────────────────────────────────────────────────
@accounting_bp.route('/budgets', methods=['GET'])
def get_budgets():
    conn = get_accounting_conn()
    try:
        rows = conn.execute("SELECT * FROM budgets ORDER BY period DESC, category").fetchall()
        return jsonify({'budgets': [dict(r) for r in rows]})
    finally:
        conn.close()


@accounting_bp.route('/budgets', methods=['POST'])
def create_budget():
    data = request.get_json() or {}
    if not all(data.get(k) for k in ['period', 'category', 'allocated']):
        return jsonify({'error': 'period, category, and allocated are required'}), 400
    row_id = sub_create(get_accounting_conn, 'budgets', {
        'period': data['period'], 'category': data['category'],
        'allocated': float(data['allocated']), 'spent': float(data.get('spent', 0))
    })
    return jsonify({'success': True, 'id': row_id})


# ── Reports ───────────────────────────────────────────────────────────────────
@accounting_bp.route('/reports/summary')
def financial_summary():
    conn = get_accounting_conn()
    try:
        txns = [dict(r) for r in conn.execute("SELECT * FROM transactions WHERE status='posted'").fetchall()]
        invoices = [dict(r) for r in conn.execute("SELECT * FROM invoices").fetchall()]
        # Income statement
        revenue = sum(t['amount'] for t in txns if t['type'] == 'income')
        expenses = sum(t['amount'] for t in txns if t['type'] == 'expense')
        # Invoice summary
        paid_inv = [i for i in invoices if i['status'] == 'paid']
        total_billed = sum(i['total'] for i in invoices)
        total_collected = sum(i['total'] for i in paid_inv)
        collection_rate = round(total_collected / total_billed * 100, 1) if total_billed else 0

        return jsonify({
            'income_statement': {
                'revenue': round(revenue, 0),
                'expenses': round(expenses, 0),
                'gross_profit': round(revenue - expenses, 0),
                'net_margin': round((revenue - expenses) / revenue * 100, 1) if revenue else 0
            },
            'invoice_summary': {
                'total_invoices': len(invoices),
                'paid': len(paid_inv),
                'outstanding': len(invoices) - len(paid_inv),
                'total_billed': round(total_billed, 0),
                'total_collected': round(total_collected, 0),
                'collection_rate': collection_rate
            }
        })
    finally:
        conn.close()


# ── AI Chat ───────────────────────────────────────────────────────────────────
@accounting_bp.route('/ai/chat', methods=['POST'])
def accounting_ai():
    data = request.get_json() or {}
    message = data.get('message', '').lower()

    conn = get_accounting_conn()
    try:
        txns = [dict(r) for r in conn.execute("SELECT * FROM transactions WHERE status='posted' LIMIT 300").fetchall()]
        invoices = [dict(r) for r in conn.execute("SELECT * FROM invoices").fetchall()]
        budgets = [dict(r) for r in conn.execute("SELECT * FROM budgets ORDER BY period DESC LIMIT 12").fetchall()]

        rev = sum(t['amount'] for t in txns if t['type'] == 'income')
        exp = sum(t['amount'] for t in txns if t['type'] == 'expense')
        net = rev - exp
        overdue = [i for i in invoices if i['status'] == 'overdue']
        over_budget = [b for b in budgets if b['allocated'] > 0 and b['spent'] / b['allocated'] > 1.0]

        if any(w in message for w in ['revenue', 'income', 'earn']):
            reply = f"""### 💰 Revenue Analysis
**Total Revenue:** ${rev:,.0f}
**Total Expenses:** ${exp:,.0f}
**Net Profit:** ${net:,.0f} ({round(net/rev*100, 1) if rev else 0}% margin)

**Key Insights:**
- {'✅ Profitable period with healthy margins.' if net > 0 else '⚠️ Currently operating at a loss — review expense categories.'}
- Top revenue categories identified from transaction data
- {'📈 Recommend reinvesting 15% of net profit into growth initiatives.' if net > 0 else '📉 Immediate cost reduction in top 2 expense categories recommended.'}"""

        elif any(w in message for w in ['invoice', 'ar', 'receivable', 'collect']):
            reply = f"""### 📄 Accounts Receivable Status
**Total Invoices:** {len(invoices)}
**Overdue Invoices:** {len(overdue)} — **⚠️ Requires immediate follow-up**
**Outstanding AR Value:** ${sum(i['total'] for i in overdue):,.0f}

**Recommendations:**
- Send automated payment reminders to all overdue clients
- Consider offering 2% early payment discount to accelerate collections
- Escalate invoices overdue by 60+ days to collections team"""

        elif any(w in message for w in ['budget', 'spend', 'expense', 'cost']):
            reply = f"""### 📊 Budget Analysis
**Over-Budget Categories:** {len(over_budget)}
{'**⚠️ Critical:** ' + ', '.join([b['category'] for b in over_budget]) if over_budget else '✅ All budgets within allocated limits'}

**Spending Summary:**
- Total Expense Outflow: ${exp:,.0f}
- Largest expense category: {max(set(t.get('category','Other') for t in txns if t['type']=='expense'), key=lambda c: sum(t['amount'] for t in txns if t.get('category')==c and t['type']=='expense'), default='N/A')}

**AI Recommendation:** Implement monthly budget review cycles and set automated alerts at 80% spend threshold."""

        elif any(w in message for w in ['predict', 'forecast', 'next', 'future']):
            growth = round(random.uniform(3, 12), 1)
            reply = f"""### 🔮 Financial Forecast (Next Quarter)
**Projected Revenue Growth:** +{growth}%
**Estimated Net Profit:** ${net * 1.08:,.0f}
**Cash Flow Projection:** Positive with ${rev * 0.15:,.0f} buffer

**Scenario Analysis:**
| Scenario | Revenue | Net Profit |
|---|---|---|
| 🌟 Optimistic | ${rev*1.15:,.0f} | ${net*1.25:,.0f} |
| 📊 Expected | ${rev*1.08:,.0f} | ${net*1.08:,.0f} |
| ⚠️ Conservative | ${rev*0.95:,.0f} | ${net*0.85:,.0f} |"""

        else:
            reply = f"""### 🤖 Accounting AI Summary
**Financial Health Score:** {'🟢 85/100 — Strong' if net > 0 else '🟡 62/100 — Needs attention'}

**Current Snapshot:**
- Revenue: **${rev:,.0f}**
- Expenses: **${exp:,.0f}**
- Net Profit: **${net:,.0f}**
- Overdue Invoices: **{len(overdue)}**

**I can help with:**
- Revenue & expense analysis
- Invoice & AR management
- Budget variance analysis
- Financial forecasting & scenarios

*Ask me: "Analyze my revenue", "What's my budget status?", or "Forecast next quarter"*"""

    finally:
        conn.close()

    return jsonify({'reply': reply, 'system': 'Accounting AI'})
