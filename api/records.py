from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import (
    get_records, get_record, create_record, update_record, delete_record,
    get_table_schema, get_all_tables, bulk_insert_csv
)
from config import ROLES
import csv, io, threading

records_bp = Blueprint('records', __name__)

# Tables that trigger learning after write
LEARNING_TABLES = {'transactions', 'invoices', 'employees', 'deals', 'campaigns', 'kpis', 'expenses', 'performance'}

def _trigger_learn(domain):
    """Fire learning loop in background thread — non-blocking."""
    try:
        from api.intelligence import learn_from_data
        t = threading.Thread(target=learn_from_data, args=(domain,), daemon=True)
        t.start()
    except Exception:
        pass  # Never block the API response


def _domain():
    return session.get('domain')


def _role():
    return session.get('role', 'operator')


def _can(perm):
    return ROLES.get(_role(), {}).get(perm, False)


@records_bp.route('/api/records/<table>', methods=['GET'])
@login_required
def list_records(table):
    domain = _domain()
    filters = {}
    search = request.args.get('search', '')
    dept = request.args.get('department', '')
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    # Enforcement: If not admin and has assigned department, force that filter
    user_dept = session.get('department')
    if user_dept and session.get('role') != 'admin':
        filters['department'] = user_dept
    elif dept:
        filters['department'] = dept
        
    rows, total = get_records(domain, table, filters=filters, limit=limit, offset=offset,
                              search=search if search else None)
    return jsonify({'rows': rows, 'total': total, 'limit': limit, 'offset': offset})


@records_bp.route('/api/records/<table>/<int:record_id>', methods=['GET'])
@login_required
def get_one(table, record_id):
    row = get_record(_domain(), table, record_id)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'record': row})


@records_bp.route('/api/records/<table>', methods=['POST'])
@login_required
def create(table):
    if not _can('can_create'):
        return jsonify({'error': 'Permission denied'}), 403
    data = request.get_json() or {}
    rid = create_record(_domain(), table, data)
    if table in LEARNING_TABLES:
        _trigger_learn(_domain())
    return jsonify({'success': True, 'id': rid}), 201


@records_bp.route('/api/records/<table>/<int:record_id>', methods=['PUT'])
@login_required
def update(table, record_id):
    if not _can('can_edit'):
        return jsonify({'error': 'Permission denied'}), 403
    data = request.get_json() or {}
    n = update_record(_domain(), table, record_id, data)
    if table in LEARNING_TABLES:
        _trigger_learn(_domain())
    return jsonify({'success': True, 'updated': n})


@records_bp.route('/api/records/<table>/<int:record_id>', methods=['DELETE'])
@login_required
def delete(table, record_id):
    if not _can('can_delete'):
        return jsonify({'error': 'Permission denied'}), 403
    n = delete_record(_domain(), table, record_id)
    return jsonify({'success': True, 'deleted': n})


@records_bp.route('/api/schema/<table>', methods=['GET'])
@login_required
def schema(table):
    cols = get_table_schema(_domain(), table)
    return jsonify({'columns': cols})


@records_bp.route('/api/tables', methods=['GET'])
@login_required
def tables():
    tbls = get_all_tables(_domain())
    return jsonify({'tables': tbls})


@records_bp.route('/api/records/<table>/export', methods=['GET'])
@login_required
def export_csv(table):
    if not _can('can_export'):
        return jsonify({'error': 'Permission denied'}), 403
    rows, _ = get_records(_domain(), table, limit=10000)
    if not rows:
        return jsonify({'error': 'No data'}), 404
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    from flask import Response
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': f'attachment; filename={table}.csv'})


@records_bp.route('/api/records/<table>/import', methods=['POST'])
@login_required
def import_csv(table):
    if not _can('can_create'):
        return jsonify({'error': 'Permission denied'}), 403
    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'No file uploaded'}), 400
    stream = io.StringIO(f.stream.read().decode('utf-8'))
    reader = csv.DictReader(stream)
    rows = list(reader)
    ids = bulk_insert_csv(_domain(), table, rows)
    return jsonify({'success': True, 'inserted': len(ids)})
