from flask import Blueprint, request, jsonify, session
from api.auth import login_required, role_required
from database.db_manager import get_records, get_all_tables, get_table_schema, get_conn
from config import DOMAINS, DEPARTMENTS, ROLES

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/api/admin/overview', methods=['GET'])
@login_required
def overview():
    """System overview: all tables and record counts per domain."""
    results = {}
    for domain_id in DOMAINS:
        conn = None
        try:
            tables = get_all_tables(domain_id)
            counts = {}
            conn = get_conn(domain_id)
            cur = conn.cursor()
            for tbl in tables:
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                counts[tbl] = cur.fetchone()[0]
            results[domain_id] = {
                'name': DOMAINS[domain_id]['name'],
                'tables': tables,
                'counts': counts,
                'total_records': sum(counts.values())
            }
        except Exception as e:
            results[domain_id] = {'error': str(e)}
        finally:
            if conn:
                conn.close()
    return jsonify({'overview': results})


@admin_bp.route('/api/admin/domain/<domain>/tables', methods=['GET'])
@login_required
def domain_tables(domain):
    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain'}), 400
    tables = get_all_tables(domain)
    result = []
    conn = get_conn(domain)
    cur = conn.cursor()
    for tbl in tables:
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        count = cur.fetchone()[0]
        schema = get_table_schema(domain, tbl)
        result.append({'name': tbl, 'count': count, 'columns': len(schema)})
    conn.close()
    return jsonify({'tables': result, 'domain': domain})


@admin_bp.route('/api/admin/domain/<domain>/table/<table>', methods=['GET'])
@login_required
def domain_table_data(domain, table):
    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain'}), 400
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    search = request.args.get('search', '')
    rows, total = get_records(domain, table, limit=limit, offset=offset,
                              search=search if search else None)
    schema = get_table_schema(domain, table)
    return jsonify({'rows': rows, 'total': total, 'schema': schema})


@admin_bp.route('/api/admin/config', methods=['GET'])
@login_required
def system_config():
    return jsonify({
        'domains': list(DOMAINS.keys()),
        'departments': {k: {'name': v['name'], 'icon': v['icon'], 'entities': v['entities']}
                        for k, v in DEPARTMENTS.items()},
        'roles': {k: {'label': v['label'], 'level': v['level']} for k, v in ROLES.items()},
    })
