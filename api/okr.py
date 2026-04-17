"""
AURA OKR System — Objectives & Key Results Tracker
Department-level and personal goals, linked to live KPIs with progress tracking.
"""
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from database.db_manager import get_conn
from config import DOMAINS

okr_bp = Blueprint('okr', __name__)

OKR_SCHEMA = """
CREATE TABLE IF NOT EXISTS okr_objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    department TEXT NOT NULL,
    user_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT,
    period TEXT,
    status TEXT DEFAULT 'active',
    progress_pct REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    due_date TEXT
);

CREATE TABLE IF NOT EXISTS okr_key_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objective_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    metric TEXT,
    target_value REAL,
    current_value REAL DEFAULT 0,
    unit TEXT DEFAULT '%',
    linked_kpi_name TEXT,
    progress_pct REAL DEFAULT 0,
    status TEXT DEFAULT 'on_track',
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(objective_id) REFERENCES okr_objectives(id)
);
"""

def ensure_okr_schema(conn):
    conn.executescript(OKR_SCHEMA)
    conn.commit()


def _calc_progress(current, target):
    if not target or target == 0:
        return 0.0
    return min(round(current / target * 100, 1), 100.0)


def _sync_objective_progress(conn, objective_id):
    """Recalculate objective progress from its key results."""
    cur = conn.cursor()
    cur.execute("SELECT progress_pct FROM okr_key_results WHERE objective_id=?", (objective_id,))
    progs = [r[0] for r in cur.fetchall() if r[0] is not None]
    avg = round(sum(progs) / len(progs), 1) if progs else 0
    status = 'completed' if avg >= 100 else 'active'
    conn.execute("UPDATE okr_objectives SET progress_pct=?, status=? WHERE id=?",
                 (avg, status, objective_id))
    conn.commit()


def _auto_seed_okrs(conn, domain, department):
    """Auto-seed default OKRs for a domain/dept if empty."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM okr_objectives WHERE domain=? AND department=?",
                (domain, department))
    if cur.fetchone()[0] > 0:
        return

    now = datetime.now()
    quarter = f"Q{(now.month-1)//3+1}-{now.year}"

    SEEDS = {
        'hr': [
            ('Improve Employee Retention', 'Reduce attrition and boost satisfaction', [
                ('Retention Rate', 'retention_rate', 95, 'current', '%'),
                ('Avg Performance Score', 'avg_performance', 80, 'current', '/100'),
                ('Reduce Time-to-Hire', 'time_to_hire', 20, 'current', 'days'),
            ]),
            ('Boost Workforce Training', 'Ensure all employees complete required training', [
                ('Training Completion Rate', 'training_completion', 90, 'current', '%'),
                ('Certified Staff Count', 'certified_staff', 50, 'current', 'staff'),
            ]),
        ],
        'finance': [
            ('Revenue Growth Target', 'Achieve quarterly revenue goals', [
                ('Revenue vs Budget', 'revenue_vs_budget', 100, 'current', '%'),
                ('Reduce Overdue Invoices', 'overdue_invoices', 0, 'current', 'items'),
                ('Budget Utilization', 'budget_utilization', 85, 'current', '%'),
            ]),
            ('Cost Optimization', 'Reduce operational expenses', [
                ('Expense Ratio', 'expense_ratio', 60, 'current', '%'),
                ('Cash Flow Efficiency', 'cash_flow', 0.9, 'current', 'ratio'),
            ]),
        ],
        'marketing': [
            ('Campaign Performance', 'Maximize campaign conversion and ROI', [
                ('Campaign Conversion Rate', 'campaign_conversion', 20, 'current', '%'),
                ('Campaign ROI', 'campaign_roi', 4.0, 'current', 'x'),
                ('Qualified Leads Generated', 'qualified_leads', 100, 'current', 'leads'),
            ]),
        ],
        'pm': [
            ('Project Delivery Excellence', 'Deliver all projects on time and within budget', [
                ('Project Completion Rate', 'project_completion', 90, 'current', '%'),
                ('Budget Adherence', 'budget_adherence', 95, 'current', '%'),
                ('Task Completion Rate', 'task_completion', 80, 'current', '%'),
            ]),
        ],
        'logistics': [
            ('Supply Chain Optimization', 'Improve delivery and inventory accuracy', [
                ('On-Time Delivery Rate', 'on_time_delivery', 98, 'current', '%'),
                ('Inventory Accuracy', 'inventory_accuracy', 99, 'current', '%'),
                ('Supplier Reliability', 'supplier_reliability', 90, 'current', 'score'),
            ]),
        ],
    }

    objectives = SEEDS.get(department, [
        ('Operational Excellence', 'Improve overall department performance', [
            ('KPI Achievement Rate', 'kpi_achievement', 85, 'current', '%'),
            ('Team Efficiency Score', 'team_efficiency', 80, 'current', '/100'),
        ]),
    ])

    for obj_title, obj_desc, key_results in objectives:
        cur.execute("""
            INSERT INTO okr_objectives (domain, department, title, description, period, owner, due_date)
            VALUES (?,?,?,?,?,?,?)
        """, (domain, department, obj_title, obj_desc, quarter,
              department.upper() + ' Team',
              f"{now.year}-{(now.month//3 + 1)*3:02d}-30"))
        obj_id = cur.lastrowid
        for kr_title, metric, target, current, unit in key_results:
            import random
            curr_val = round(target * random.uniform(0.5, 0.95), 1)
            pct = _calc_progress(curr_val, target)
            status = 'achieved' if pct >= 100 else ('at_risk' if pct < 60 else 'on_track')
            cur.execute("""
                INSERT INTO okr_key_results
                  (objective_id, title, metric, target_value, current_value, unit,
                   linked_kpi_name, progress_pct, status)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (obj_id, kr_title, metric, target, curr_val, unit, metric, pct, status))

    conn.commit()


# ── REST Endpoints ────────────────────────────────────────────────────────────

@okr_bp.route('/api/okr/objectives', methods=['GET'])
def list_objectives():
    domain     = request.args.get('domain', 'banking')
    department = request.args.get('department')
    user_id    = request.args.get('user_id')
    period     = request.args.get('period')

    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        if department:
            _auto_seed_okrs(conn, domain, department)

        cur = conn.cursor()
        conds = ['domain=?']; params = [domain]
        if department: conds.append('department=?'); params.append(department)
        if user_id:    conds.append('(user_id IS NULL OR user_id=?)'); params.append(int(user_id))
        if period:     conds.append('period=?'); params.append(period)

        cur.execute(f"SELECT * FROM okr_objectives WHERE {' AND '.join(conds)} ORDER BY status, progress_pct DESC", params)
        cols = [d[0] for d in cur.description]
        objectives = [dict(zip(cols, r)) for r in cur.fetchall()]

        # Attach key results
        for obj in objectives:
            cur.execute("SELECT * FROM okr_key_results WHERE objective_id=? ORDER BY progress_pct DESC", (obj['id'],))
            kr_cols = [d[0] for d in cur.description]
            obj['key_results'] = [dict(zip(kr_cols, r)) for r in cur.fetchall()]

        conn.close()
        return jsonify({'objectives': objectives, 'total': len(objectives)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/objectives', methods=['POST'])
def create_objective():
    data = request.json or {}
    domain = data.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        now = datetime.now()
        quarter = f"Q{(now.month-1)//3+1}-{now.year}"
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO okr_objectives
              (domain, department, user_id, title, description, owner, period, due_date)
            VALUES (?,?,?,?,?,?,?,?)
        """, (domain, data.get('department','operations'), data.get('user_id'),
              data['title'], data.get('description'), data.get('owner'),
              data.get('period', quarter), data.get('due_date')))
        obj_id = cur.lastrowid
        conn.commit()
        conn.close()
        from api.audit import log_action
        log_action(domain, data.get('user_id'), 'CREATE', 'okr_objective', obj_id,
                   None, data, f"Created OKR: {data['title']}")
        return jsonify({'id': obj_id, 'status': 'created'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/objectives/<int:oid>', methods=['GET'])
def get_objective(oid):
    domain = request.args.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        cur = conn.cursor()
        cur.execute("SELECT * FROM okr_objectives WHERE id=? AND domain=?", (oid, domain))
        cols = [d[0] for d in cur.description]
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Not found'}), 404
        obj = dict(zip(cols, row))
        cur.execute("SELECT * FROM okr_key_results WHERE objective_id=? ORDER BY progress_pct DESC", (oid,))
        kr_cols = [d[0] for d in cur.description]
        obj['key_results'] = [dict(zip(kr_cols, r)) for r in cur.fetchall()]
        conn.close()
        return jsonify(obj)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/objectives/<int:oid>', methods=['PUT'])
def update_objective(oid):
    data = request.json or {}
    domain = data.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        updates = {k: v for k, v in data.items()
                   if k in ('title','description','owner','status','period','due_date')}
        if not updates:
            conn.close()
            return jsonify({'error': 'No valid fields'}), 400
        sets = ', '.join(f'{k}=?' for k in updates)
        conn.execute(f"UPDATE okr_objectives SET {sets} WHERE id=? AND domain=?",
                     list(updates.values()) + [oid, domain])
        conn.commit()
        conn.close()
        return jsonify({'status': 'updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/objectives/<int:oid>/key-results', methods=['GET'])
def list_key_results(oid):
    domain = request.args.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        cur = conn.cursor()
        cur.execute("SELECT * FROM okr_key_results WHERE objective_id=?", (oid,))
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        conn.close()
        return jsonify({'key_results': rows})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/objectives/<int:oid>/key-results', methods=['POST'])
def create_key_result(oid):
    data = request.json or {}
    domain = data.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        target = float(data.get('target_value', 100))
        current = float(data.get('current_value', 0))
        pct = _calc_progress(current, target)
        status = 'achieved' if pct >= 100 else ('at_risk' if pct < 60 else 'on_track')
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO okr_key_results
              (objective_id, title, metric, target_value, current_value, unit,
               linked_kpi_name, progress_pct, status)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (oid, data['title'], data.get('metric'), target, current,
              data.get('unit', '%'), data.get('linked_kpi_name'), pct, status))
        kr_id = cur.lastrowid
        _sync_objective_progress(conn, oid)
        conn.close()
        return jsonify({'id': kr_id, 'progress_pct': pct, 'status': status}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/key-results/<int:kid>', methods=['PUT'])
def update_key_result(kid):
    data = request.json or {}
    domain = data.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        cur = conn.cursor()
        cur.execute("SELECT objective_id, target_value FROM okr_key_results WHERE id=?", (kid,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'error': 'Not found'}), 404
        obj_id, target = row
        current = float(data.get('current_value', 0))
        pct = _calc_progress(current, target)
        status = 'achieved' if pct >= 100 else ('at_risk' if pct < 60 else 'on_track')
        conn.execute("""
            UPDATE okr_key_results
            SET current_value=?, progress_pct=?, status=?, updated_at=?
            WHERE id=?
        """, (current, pct, status, datetime.now().isoformat(), kid))
        _sync_objective_progress(conn, obj_id)
        conn.close()
        return jsonify({'progress_pct': pct, 'status': status})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@okr_bp.route('/api/okr/summary', methods=['GET'])
def get_okr_summary():
    domain = request.args.get('domain', 'banking')
    department = request.args.get('department')
    try:
        conn = get_conn(domain)
        ensure_okr_schema(conn)
        if department:
            _auto_seed_okrs(conn, domain, department)
        cur = conn.cursor()

        conds = ['domain=?']; params = [domain]
        if department: conds.append('department=?'); params.append(department)

        cur.execute(f"""
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
              AVG(progress_pct) as avg_progress
            FROM okr_objectives WHERE {' AND '.join(conds)}
        """, params)
        stats = dict(zip(['total','completed','active','avg_progress'], cur.fetchone()))

        cur.execute(f"""
            SELECT o.department, AVG(o.progress_pct) as dept_progress, COUNT(*) as cnt
            FROM okr_objectives o WHERE {' AND '.join(conds)}
            GROUP BY o.department ORDER BY dept_progress DESC
        """, params)
        by_dept = [{'department': r[0], 'progress': round(r[1] or 0, 1), 'objectives': r[2]}
                   for r in cur.fetchall()]

        cur.execute(f"""
            SELECT kr.status, COUNT(*) as cnt
            FROM okr_key_results kr
            JOIN okr_objectives o ON kr.objective_id=o.id
            WHERE {' AND '.join(conds)}
            GROUP BY kr.status
        """, params)
        kr_by_status = {r[0]: r[1] for r in cur.fetchall()}

        conn.close()
        return jsonify({
            'stats': {k: round(v, 1) if isinstance(v, float) else (v or 0) for k, v in stats.items()},
            'by_department': by_dept,
            'key_results_by_status': kr_by_status
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
