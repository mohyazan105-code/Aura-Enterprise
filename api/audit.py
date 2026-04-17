"""
AURA Audit Trail System — Full Transparency Layer
Bank-grade logging for all user actions, AI decisions, and data changes.
"""
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from database.db_manager import get_conn
from config import DOMAINS

audit_bp = Blueprint('audit', __name__)

AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    user_role TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    before_json TEXT,
    after_json TEXT,
    description TEXT,
    ip_address TEXT,
    session_id TEXT,
    is_ai_action INTEGER DEFAULT 0,
    autopilot_action_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_domain ON audit_log(domain);
CREATE INDEX IF NOT EXISTS idx_audit_user  ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time  ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_type  ON audit_log(action_type);

CREATE TABLE IF NOT EXISTS smart_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    target_role TEXT DEFAULT 'all',
    target_user_id INTEGER,
    target_department TEXT,
    title TEXT NOT NULL,
    message TEXT,
    category TEXT,
    priority TEXT DEFAULT 'info',
    source_type TEXT,
    source_id INTEGER,
    action_url TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_domain ON smart_notifications(domain);
"""

def ensure_audit_schema(conn):
    conn.executescript(AUDIT_SCHEMA)
    conn.commit()


def log_action(domain, user_id, action_type, entity_type=None, entity_id=None,
               before=None, after=None, description=None, is_ai=False,
               autopilot_action_id=None, user_name=None, user_role=None):
    """
    Core audit logging function. Call from any API route on write operations.
    Thread-safe, non-blocking — failures are silently suppressed.
    """
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        ip = None
        sid = None
        try:
            ip = request.remote_addr
            sid = session.get('session_id', request.environ.get('HTTP_X_SESSION_ID'))
        except Exception:
            pass

        # Resolve user info from session if not provided
        if user_name is None:
            try:
                user_name = session.get('user_name', 'System')
            except Exception:
                user_name = 'System'
        if user_role is None:
            try:
                user_role = session.get('role', 'system')
            except Exception:
                user_role = 'system'

        conn.execute("""
            INSERT INTO audit_log
              (domain, user_id, user_name, user_role, action_type, entity_type, entity_id,
               before_json, after_json, description, ip_address, session_id,
               is_ai_action, autopilot_action_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            domain,
            user_id,
            user_name,
            user_role,
            action_type,
            entity_type,
            str(entity_id) if entity_id is not None else None,
            json.dumps(before, default=str) if before is not None else None,
            json.dumps(after,  default=str) if after  is not None else None,
            description,
            ip,
            sid,
            1 if is_ai else 0,
            autopilot_action_id,
            datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
    except Exception:
        pass  # Audit must never break the application


def push_notification(domain, title, message, category='system', priority='info',
                      target_role='admin', source_type=None, source_id=None,
                      target_user_id=None, target_department=None, action_url=None):
    """Push a smart notification to the notifications queue."""
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        conn.execute("""
            INSERT INTO smart_notifications
              (domain, target_role, target_user_id, target_department, title, message,
               category, priority, source_type, source_id, action_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (domain, target_role, target_user_id, target_department, title, message,
              category, priority, source_type, source_id, action_url))
        conn.commit()
        conn.close()
    except Exception:
        pass


# ── REST Endpoints ────────────────────────────────────────────────────────────

@audit_bp.route('/api/audit/log', methods=['GET'])
def get_audit_log():
    domain = request.args.get('domain', 'banking')
    if domain not in DOMAINS:
        return jsonify({'error': 'Invalid domain'}), 400

    action_type = request.args.get('action_type')
    user_id    = request.args.get('user_id')
    entity_type= request.args.get('entity_type')
    date_from  = request.args.get('date_from')
    date_to    = request.args.get('date_to')
    search     = request.args.get('search', '').strip()
    limit      = min(int(request.args.get('limit', 100)), 500)
    offset     = int(request.args.get('offset', 0))

    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        cur = conn.cursor()

        where = ['domain = ?']
        params = [domain]

        if action_type:
            where.append('action_type = ?'); params.append(action_type)
        if user_id:
            where.append('user_id = ?'); params.append(int(user_id))
        if entity_type:
            where.append('entity_type = ?'); params.append(entity_type)
        if date_from:
            where.append("created_at >= ?"); params.append(date_from)
        if date_to:
            where.append("created_at <= ?"); params.append(date_to + 'T23:59:59')
        if search:
            where.append("(description LIKE ? OR user_name LIKE ? OR entity_type LIKE ?)")
            params += [f'%{search}%', f'%{search}%', f'%{search}%']

        sql = f"""
            SELECT * FROM audit_log
            WHERE {' AND '.join(where)}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        params += [limit, offset]
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

        # Parse JSON fields
        for r in rows:
            for f in ('before_json', 'after_json'):
                if r.get(f):
                    try: r[f] = json.loads(r[f])
                    except Exception: pass

        # Count
        count_sql = f"SELECT COUNT(*) FROM audit_log WHERE {' AND '.join(where[:-0])}"
        count_params = params[:-2]
        cur.execute(f"SELECT COUNT(*) FROM audit_log WHERE {' AND '.join(where)}", count_params)
        total = cur.fetchone()[0]

        conn.close()
        return jsonify({'logs': rows, 'total': total, 'offset': offset, 'limit': limit})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/api/audit/log', methods=['POST'])
def write_audit_log():
    data = request.json or {}
    domain = data.get('domain', 'banking')
    log_action(
        domain=domain,
        user_id=data.get('user_id'),
        action_type=data.get('action_type', 'MANUAL'),
        entity_type=data.get('entity_type'),
        entity_id=data.get('entity_id'),
        before=data.get('before'),
        after=data.get('after'),
        description=data.get('description'),
        is_ai=data.get('is_ai', False),
        user_name=data.get('user_name'),
        user_role=data.get('user_role')
    )
    return jsonify({'status': 'logged'})


@audit_bp.route('/api/audit/timeline/<entity_type>/<entity_id>', methods=['GET'])
def get_timeline(entity_type, entity_id):
    domain = request.args.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM audit_log
            WHERE domain=? AND entity_type=? AND entity_id=?
            ORDER BY created_at ASC
        """, (domain, entity_type, str(entity_id)))
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        for r in rows:
            for f in ('before_json', 'after_json'):
                if r.get(f):
                    try: r[f] = json.loads(r[f])
                    except Exception: pass
        conn.close()
        return jsonify({'timeline': rows, 'entity': entity_type, 'id': entity_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/api/audit/stats', methods=['GET'])
def get_audit_stats():
    domain = request.args.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM audit_log WHERE domain=?", (domain,))
        total = cur.fetchone()[0]

        cur.execute("""
            SELECT action_type, COUNT(*) as cnt
            FROM audit_log WHERE domain=?
            GROUP BY action_type ORDER BY cnt DESC
        """, (domain,))
        by_type = [{'type': r[0], 'count': r[1]} for r in cur.fetchall()]

        cur.execute("""
            SELECT user_name, COUNT(*) as cnt
            FROM audit_log WHERE domain=? AND user_name IS NOT NULL
            GROUP BY user_name ORDER BY cnt DESC LIMIT 5
        """, (domain,))
        by_user = [{'user': r[0], 'count': r[1]} for r in cur.fetchall()]

        cur.execute("""
            SELECT date(created_at) as day, COUNT(*) as cnt
            FROM audit_log WHERE domain=?
            GROUP BY day ORDER BY day DESC LIMIT 30
        """, (domain,))
        by_day = [{'date': r[0], 'count': r[1]} for r in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(*) FROM audit_log
            WHERE domain=? AND is_ai_action=1
        """, (domain,))
        ai_actions = cur.fetchone()[0]

        conn.close()
        return jsonify({
            'total': total,
            'ai_actions': ai_actions,
            'by_type': by_type,
            'by_user': by_user,
            'by_day': by_day
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/api/audit/export', methods=['GET'])
def export_audit():
    """Export audit log as CSV."""
    import csv, io
    domain = request.args.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        cur = conn.cursor()
        cur.execute("""
            SELECT id, created_at, user_name, user_role, action_type,
                   entity_type, entity_id, description, is_ai_action
            FROM audit_log WHERE domain=? ORDER BY created_at DESC LIMIT 1000
        """, (domain,))
        rows = cur.fetchall()
        conn.close()

        output = io.StringIO()
        w = csv.writer(output)
        w.writerow(['ID','Timestamp','User','Role','Action','Entity','EntityID','Description','AI?'])
        for r in rows:
            w.writerow(r)

        from flask import Response
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment;filename=audit_{domain}.csv'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Notifications ─────────────────────────────────────────────────────────────

@audit_bp.route('/api/notifications/smart', methods=['GET'])
def get_smart_notifications():
    domain = request.args.get('domain', 'banking')
    role   = request.args.get('role', 'admin')
    user_id= request.args.get('user_id')
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        cur = conn.cursor()

        conds = ["domain=?", "(target_role='all' OR target_role=?)"]
        params = [domain, role]
        if user_id:
            conds.append("(target_user_id IS NULL OR target_user_id=?)")
            params.append(int(user_id))
        if unread_only:
            conds.append("is_read=0")

        cur.execute(f"""
            SELECT * FROM smart_notifications
            WHERE {' AND '.join(conds)}
            ORDER BY
              CASE priority WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
              created_at DESC
            LIMIT 50
        """, params)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

        cur.execute(f"SELECT COUNT(*) FROM smart_notifications WHERE domain=? AND is_read=0", (domain,))
        unread = cur.fetchone()[0]

        conn.close()
        return jsonify({'notifications': rows, 'unread_count': unread})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/api/notifications/smart/<int:nid>/read', methods=['POST'])
def mark_notification_read(nid):
    domain = request.json.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        conn.execute("UPDATE smart_notifications SET is_read=1 WHERE id=?", (nid,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'read'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@audit_bp.route('/api/notifications/smart/read-all', methods=['POST'])
def mark_all_read():
    domain = request.json.get('domain', 'banking')
    try:
        conn = get_conn(domain)
        ensure_audit_schema(conn)
        conn.execute("UPDATE smart_notifications SET is_read=1 WHERE domain=?", (domain,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'all read'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
