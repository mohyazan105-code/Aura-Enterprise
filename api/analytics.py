from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from api.ai_engine import (
    get_line_chart_data, get_pie_chart_data,
    get_heatmap_data, get_goal_progress, get_kmeans_3d_data,
    get_ball_chart_data, AuraAI, generate_org_chart, generate_erd,
    get_specialized_analytics
)
from api.intelligence import (
    time_series_analysis, detect_anomalies,
    cluster_customers, cluster_employees,
    calculate_clv, churn_prediction, attrition_risk,
    campaign_roi_analysis, budget_vs_actual,
    process_mining, learn_from_data, get_patterns,
    get_adaptive_kpis, analyze_legacy_db, forecast_series
)
from api.performance import get_cached, set_cache, clear_cache
from database.db_manager import get_records, get_conn
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

analytics_bp = Blueprint('analytics', __name__)


def _domain():   return session.get('domain')
def _dept():
    requested = request.args.get('department', 'hr')
    user_dept  = session.get('department')
    if user_dept and session.get('role') != 'admin':
        return user_dept
    return requested
def _role():     return session.get('role', 'operator')


# ─── Existing endpoints (preserved) ──────────────────────────────

@analytics_bp.route('/api/analytics/kpis')
@login_required
def dashboard_kpis():
    """Live KPIs computed from real DB data + custom user KPIs."""
    cache_key = f"kpis_{_domain()}_{_dept()}_{_role()}"
    cached = get_cached(cache_key)
    if cached:
        return jsonify(cached)
    result = {'kpis': get_adaptive_kpis(_domain(), _dept(), _role())}
    set_cache(cache_key, result, ttl=45)
    return jsonify(result)


@analytics_bp.route('/api/analytics/line')
@login_required
def line_chart():
    return jsonify(get_line_chart_data(_domain(), _dept()))


@analytics_bp.route('/api/analytics/pie')
@login_required
def pie_chart():
    return jsonify(get_pie_chart_data(_domain(), _dept()))


@analytics_bp.route('/api/analytics/heatmap')
@login_required
def heatmap():
    return jsonify(get_heatmap_data(_domain(), _dept()))


@analytics_bp.route('/api/analytics/goals')
@login_required
def goals():
    return jsonify({'goals': get_goal_progress(_domain(), _dept())})


@analytics_bp.route('/api/analytics/kmeans')
@login_required
def kmeans():
    return jsonify(get_kmeans_3d_data(_domain(), _dept()))


@analytics_bp.route('/api/analytics/balls')
@login_required
def balls():
    return jsonify(get_ball_chart_data(_domain(), _dept()))


@analytics_bp.route('/api/analytics/org-chart')
@login_required
def org_chart():
    return jsonify(generate_org_chart(_domain()))


@analytics_bp.route('/api/analytics/erd')
@login_required
def erd():
    return jsonify({'erd': generate_erd(_domain())})


@analytics_bp.route('/api/analytics/special')
@login_required
def specialized():
    return jsonify(get_specialized_analytics(_domain(), _dept()))


@analytics_bp.route('/api/analytics/summary')
@login_required
def summary():
    domain = _domain()
    cache_key = f"summary_{domain}"
    cached = get_cached(cache_key)
    if cached:
        return jsonify(cached)

    tables = ['employees', 'tasks', 'customers', 'invoices', 'projects']
    totals = {}

    def _fetch(tbl):
        _, total = get_records(domain, tbl, limit=1)
        return tbl, total

    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(_fetch, t): t for t in tables}
        for fut in as_completed(futures):
            tbl, total = fut.result()
            totals[tbl] = total

    result = {'counts': {
        'employees': totals.get('employees', 0),
        'tasks':     totals.get('tasks', 0),
        'customers': totals.get('customers', 0),
        'invoices':  totals.get('invoices', 0),
        'projects':  totals.get('projects', 0),
    }}
    set_cache(cache_key, result, ttl=60)
    return jsonify(result)


# ─── NEW: Intelligence Endpoints ─────────────────────────────────

@analytics_bp.route('/api/analytics/timeseries')
@login_required
def timeseries():
    """Full time-series with trend, smoothing, seasonality, and forecast."""
    metric  = request.args.get('metric', 'revenue')
    periods = int(request.args.get('periods', 6))
    
    cache_key = f"timeseries_{_domain()}_{_dept()}_{metric}_{periods}"
    cached = get_cached(cache_key)
    if cached: return jsonify(cached)
    
    result  = time_series_analysis(_domain(), _dept(), metric, periods_ahead=periods)
    set_cache(cache_key, result, ttl=60) # 60 second cache
    
    return jsonify(result)


@analytics_bp.route('/api/analytics/forecast')
@login_required
def forecast():
    """Revenue / demand forecast for configurable horizon."""
    periods = int(request.args.get('periods', 6))
    metric  = request.args.get('metric', 'revenue')
    result  = time_series_analysis(_domain(), _dept(), metric, periods_ahead=periods)
    return jsonify({
        'metric': metric,
        'periods_ahead': periods,
        'historical': result.get('historical', []),
        'forecast': result.get('forecast', []),
        'labels': result.get('labels', []),
        'trend': result.get('trend'),
        'confidence_band': result.get('confidence_band'),
        'r_squared': result.get('r_squared'),
        'has_seasonality': result.get('has_seasonality'),
    })


@analytics_bp.route('/api/analytics/anomalies')
@login_required
def anomalies():
    """Z-score anomaly detection across transactions and expenses."""
    threshold = float(request.args.get('threshold', 2.5))
    
    cache_key = f"anomalies_{_domain()}_{_dept()}_{threshold}"
    cached = get_cached(cache_key)
    if cached: return jsonify(cached)
    
    result = detect_anomalies(_domain(), _dept(), threshold=threshold)
    resp = {'anomalies': result, 'count': len(result)}
    set_cache(cache_key, resp, ttl=120)
    
    return jsonify(resp)


@analytics_bp.route('/api/analytics/clusters')
@login_required
def clusters():
    """K-Means clustering — customers or employees based on dept."""
    k = int(request.args.get('k', 3))
    target = request.args.get('target', 'customers')
    if target == 'employees' or _dept() == 'hr':
        result = cluster_employees(_domain(), k=k)
    else:
        result = cluster_customers(_domain(), k=k)
    return jsonify(result)


@analytics_bp.route('/api/analytics/clv')
@login_required
def clv():
    """Customer Lifetime Value analysis."""
    result = calculate_clv(_domain())
    return jsonify(result)


@analytics_bp.route('/api/analytics/churn')
@login_required
def churn():
    """Churn risk scoring for all customers."""
    result = churn_prediction(_domain())
    return jsonify(result)


@analytics_bp.route('/api/analytics/roi')
@login_required
def roi():
    """Campaign ROI analysis."""
    result = campaign_roi_analysis(_domain())
    return jsonify(result)


@analytics_bp.route('/api/analytics/attrition')
@login_required
def attrition():
    """Employee attrition risk scoring."""
    result = attrition_risk(_domain())
    return jsonify(result)


@analytics_bp.route('/api/analytics/process-mining')
@login_required
def proc_mining():
    """Process pattern discovery from workflow logs."""
    result = process_mining(_domain(), _dept())
    return jsonify(result)


@analytics_bp.route('/api/analytics/budget-vs-actual')
@login_required
def budget_actual():
    """Real budget deviation analysis."""
    result = budget_vs_actual(_domain())
    return jsonify(result)


@analytics_bp.route('/api/analytics/patterns')
@login_required
def patterns():
    """All persisted learned patterns for the domain."""
    result = get_patterns(_domain())
    return jsonify({'patterns': result, 'count': len(result)})


@analytics_bp.route('/api/analytics/learn', methods=['POST'])
@login_required
def trigger_learn():
    """Manually trigger the learning loop for the current domain."""
    try:
        learn_from_data(_domain())
        # Invalidate stale analytics caches for this domain
        clear_cache(prefix=f"kpis_{_domain()}")
        clear_cache(prefix=f"summary_{_domain()}")
        clear_cache(prefix=f"timeseries_{_domain()}")
        clear_cache(prefix=f"anomalies_{_domain()}")
        return jsonify({'success': True, 'message': 'Learning cycle complete. Caches cleared.'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ─── Custom KPI Engine ────────────────────────────────────────────

@analytics_bp.route('/api/analytics/kpi/custom', methods=['GET'])
@login_required
def get_custom_kpis():
    """Fetch all custom KPIs for this domain/dept/role."""
    conn = get_conn(_domain())
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM kpi_custom
            WHERE domain=? AND department=? AND is_active=1 AND (role='all' OR role=?)
            ORDER BY created_at DESC
        """, (_domain(), _dept(), _role()))
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return jsonify({'kpis': rows})
    finally:
        conn.close()


@analytics_bp.route('/api/analytics/kpi/custom', methods=['POST'])
@login_required
def add_custom_kpi():
    """Add a new custom KPI."""
    data = request.get_json() or {}
    required = ['name']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'Missing required field: {field}'}), 400

    conn = get_conn(_domain())
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO kpi_custom (domain, department, role, name, formula, target, unit, icon, color, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            _domain(),
            data.get('department', _dept()),
            data.get('role', 'all'),
            data['name'],
            data.get('formula', ''),
            data.get('target', 100),
            data.get('unit', '%'),
            data.get('icon', '📊'),
            data.get('color', '#1a73e8'),
            session.get('user_id')
        ))
        conn.commit()
        return jsonify({'success': True, 'id': cur.lastrowid}), 201
    finally:
        conn.close()


@analytics_bp.route('/api/analytics/kpi/custom/<int:kpi_id>', methods=['DELETE'])
@login_required
def delete_custom_kpi(kpi_id):
    """Soft-delete a custom KPI."""
    conn = get_conn(_domain())
    try:
        cur = conn.cursor()
        cur.execute("UPDATE kpi_custom SET is_active=0 WHERE id=? AND domain=?", (kpi_id, _domain()))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@analytics_bp.route('/api/analytics/kpi/custom/<int:kpi_id>', methods=['PUT'])
@login_required
def update_custom_kpi(kpi_id):
    """Update a custom KPI's properties."""
    data = request.get_json() or {}
    conn = get_conn(_domain())
    try:
        cur = conn.cursor()
        fields = ['name', 'formula', 'target', 'unit', 'icon', 'color', 'role']
        updates = {f: data[f] for f in fields if f in data}
        if not updates:
            return jsonify({'error': 'No fields to update'}), 400
        set_clause = ', '.join(f'{k}=?' for k in updates)
        cur.execute(f"UPDATE kpi_custom SET {set_clause} WHERE id=? AND domain=?",
                    (*updates.values(), kpi_id, _domain()))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ─── Legacy Database Analyzer ─────────────────────────────────────

@analytics_bp.route('/api/analytics/legacy-analyze', methods=['POST'])
@login_required
def legacy_analyze():
    """
    Analyze an uploaded legacy database file.
    Supports: .db (SQLite), .csv, .xlsx / .xls
    """
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded. Send file as multipart/form-data.'}), 400

    filename = file.filename or 'unknown'
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ('db', 'csv', 'xlsx', 'xls'):
        return jsonify({'error': f'Unsupported file type: .{ext}. Supported: .db, .csv, .xlsx'}), 400

    try:
        file_bytes = file.read()
        result = analyze_legacy_db(file_bytes, filename)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
