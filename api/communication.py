"""
ActionAura — Internal Communication API
Handles: call system, meetings, contact list, status, and activation control.
"""

from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn
from datetime import datetime, timedelta
import json
import random
import string

comm_bp = Blueprint('communication', __name__)

def _domain():   return session.get('domain')
def _user_id():  return session.get('user_id')
def _role():     return session.get('role')
def _dept():     return session.get('department')


# ─────────────────────────────────────────────────────────────────
# SCHEMA MIGRATION — called on first use
# ─────────────────────────────────────────────────────────────────

COMM_SCHEMA = """
-- Activation flag (single row)
CREATE TABLE IF NOT EXISTS comm_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_active INTEGER DEFAULT 0,
    activated_by INTEGER,
    activated_at TEXT
);

-- User presence / status
CREATE TABLE IF NOT EXISTS comm_status (
    user_id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'offline',  -- online | busy | offline | away
    last_seen TEXT DEFAULT (datetime('now'))
);

-- Call records
CREATE TABLE IF NOT EXISTS comm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_id INTEGER NOT NULL,
    caller_name TEXT,
    callee_id INTEGER NOT NULL,
    callee_name TEXT,
    department TEXT,
    status TEXT DEFAULT 'ringing', -- ringing | active | ended | missed | rejected
    started_at TEXT DEFAULT (datetime('now')),
    answered_at TEXT,
    ended_at TEXT,
    duration_seconds INTEGER DEFAULT 0,
    notes TEXT
);

-- Meeting rooms
CREATE TABLE IF NOT EXISTS comm_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    host_id INTEGER NOT NULL,
    host_name TEXT,
    room_code TEXT UNIQUE,
    department TEXT,
    status TEXT DEFAULT 'scheduled', -- scheduled | ongoing | ended
    scheduled_at TEXT,
    started_at TEXT,
    ended_at TEXT,
    invite_json TEXT,   -- JSON list of invited user_ids
    agenda TEXT,
    chat_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Meeting participants (join log)
CREATE TABLE IF NOT EXISTS comm_meeting_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    joined_at TEXT DEFAULT (datetime('now')),
    left_at TEXT,
    FOREIGN KEY(meeting_id) REFERENCES comm_meetings(id)
);
"""

def ensure_comm_schema(conn):
    conn.executescript(COMM_SCHEMA)
    # Ensure default settings row
    conn.execute("INSERT OR IGNORE INTO comm_settings (id, is_active) VALUES (1, 0)")
    conn.commit()


def _gen_room_code(length=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ─────────────────────────────────────────────────────────────────
# ACTIVATION
# ─────────────────────────────────────────────────────────────────

@comm_bp.route('/status', methods=['GET'])
@login_required
def get_comm_status():
    """Check if communication system is active."""
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        row = conn.execute("SELECT * FROM comm_settings WHERE id=1").fetchone()
        return jsonify({'active': bool(row['is_active']), 'activated_at': row['activated_at']})
    finally:
        conn.close()


@comm_bp.route('/activate', methods=['POST'])
@login_required
def activate_comm():
    """Admin only: activate or deactivate the communication system."""
    if _role() != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    data = request.get_json() or {}
    activate = data.get('activate', True)
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        if activate:
            conn.execute("""
                UPDATE comm_settings SET is_active=1, activated_by=?, activated_at=? WHERE id=1
            """, (_user_id(), datetime.now().isoformat()))
        else:
            conn.execute("UPDATE comm_settings SET is_active=0 WHERE id=1")
        conn.commit()
        return jsonify({'success': True, 'active': activate})
    finally:
        conn.close()


def _require_active(conn):
    """Returns False if comm system is inactive."""
    row = conn.execute("SELECT is_active FROM comm_settings WHERE id=1").fetchone()
    return row and bool(row['is_active'])


# ─────────────────────────────────────────────────────────────────
# CONTACTS (from users + employees table)
# ─────────────────────────────────────────────────────────────────

@comm_bp.route('/contacts', methods=['GET'])
@login_required
def get_contacts():
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)

        # Build contact list from users table
        users = conn.execute("""
            SELECT u.id, u.name, u.email, u.department, u.role,
                   COALESCE(cs.status, 'offline') as presence
            FROM users u
            LEFT JOIN comm_status cs ON u.id = cs.user_id
            WHERE u.id != ?
            ORDER BY u.department, u.name
        """, (_user_id(),)).fetchall()

        contacts = {}
        for u in users:
            dept = u['department'] or 'general'
            if dept not in contacts:
                contacts[dept] = []
            contacts[dept].append({
                'id': u['id'],
                'name': u['name'],
                'email': u['email'],
                'department': dept,
                'role': u['role'],
                'status': u['presence']
            })

        return jsonify({'contacts': contacts})
    finally:
        conn.close()


@comm_bp.route('/presence', methods=['POST'])
@login_required
def set_presence():
    """Update current user's presence status."""
    data = request.get_json() or {}
    status = data.get('status', 'online')
    if status not in ('online', 'busy', 'offline', 'away'):
        return jsonify({'error': 'Invalid status'}), 400
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        conn.execute("""
            INSERT INTO comm_status (user_id, status, last_seen)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET status=excluded.status, last_seen=excluded.last_seen
        """, (_user_id(), status, datetime.now().isoformat()))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────
# CALLS
# ─────────────────────────────────────────────────────────────────

@comm_bp.route('/calls/initiate', methods=['POST'])
@login_required
def initiate_call():
    data = request.get_json() or {}
    callee_id = data.get('callee_id')
    if not callee_id:
        return jsonify({'error': 'callee_id required'}), 400

    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        if not _require_active(conn):
            return jsonify({'error': 'Communication system not activated'}), 403

        caller = conn.execute("SELECT name, department FROM users WHERE id=?", (_user_id(),)).fetchone()
        callee = conn.execute("SELECT name, department FROM users WHERE id=?", (callee_id,)).fetchone()
        if not callee:
            return jsonify({'error': 'Callee not found'}), 404

        # Check callee busy status
        callee_status = conn.execute("SELECT status FROM comm_status WHERE user_id=?", (callee_id,)).fetchone()
        if callee_status and callee_status['status'] == 'busy':
            return jsonify({'error': 'User is currently busy', 'busy': True}), 409

        conn.execute("""
            INSERT INTO comm_calls (caller_id, caller_name, callee_id, callee_name, department, status)
            VALUES (?, ?, ?, ?, ?, 'ringing')
        """, (_user_id(), caller['name'] if caller else 'Unknown',
               callee_id, callee['name'], caller['department'] if caller else None))
        conn.commit()
        call_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Set caller as busy
        conn.execute("""
            INSERT INTO comm_status (user_id, status, last_seen) VALUES (?, 'busy', ?)
            ON CONFLICT(user_id) DO UPDATE SET status='busy', last_seen=excluded.last_seen
        """, (_user_id(), datetime.now().isoformat()))
        conn.commit()

        return jsonify({'success': True, 'call_id': call_id, 'callee_name': callee['name']})
    finally:
        conn.close()


@comm_bp.route('/calls/respond', methods=['POST'])
@login_required
def respond_to_call():
    data = request.get_json() or {}
    call_id = data.get('call_id')
    action  = data.get('action')  # accept | reject | end | miss
    if not call_id or action not in ('accept', 'reject', 'end', 'miss'):
        return jsonify({'error': 'call_id and valid action required'}), 400

    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        call = conn.execute("SELECT * FROM comm_calls WHERE id=?", (call_id,)).fetchone()
        if not call:
            return jsonify({'error': 'Call not found'}), 404

        now = datetime.now().isoformat()
        if action == 'accept':
            conn.execute("UPDATE comm_calls SET status='active', answered_at=? WHERE id=?", (now, call_id))
            # Set callee as busy
            conn.execute("""
                INSERT INTO comm_status (user_id, status, last_seen) VALUES (?, 'busy', ?)
                ON CONFLICT(user_id) DO UPDATE SET status='busy', last_seen=excluded.last_seen
            """, (_user_id(), now))

        elif action in ('reject', 'end', 'miss'):
            status_map = {'reject': 'rejected', 'end': 'ended', 'miss': 'missed'}
            duration = 0
            if call['answered_at']:
                try:
                    start = datetime.fromisoformat(call['answered_at'])
                    duration = int((datetime.now() - start).total_seconds())
                except Exception:
                    duration = 0
            conn.execute("""
                UPDATE comm_calls SET status=?, ended_at=?, duration_seconds=? WHERE id=?
            """, (status_map[action], now, duration, call_id))

            # Release busy status for both parties
            for uid in [call['caller_id'], call['callee_id']]:
                conn.execute("""
                    INSERT INTO comm_status (user_id, status, last_seen) VALUES (?, 'online', ?)
                    ON CONFLICT(user_id) DO UPDATE SET status='online', last_seen=excluded.last_seen
                """, (uid, now))

        conn.commit()
        return jsonify({'success': True, 'action': action})
    finally:
        conn.close()


@comm_bp.route('/calls/incoming', methods=['GET'])
@login_required
def get_incoming_calls():
    """Poll for ringing calls directed at this user."""
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        calls = conn.execute("""
            SELECT * FROM comm_calls
            WHERE callee_id=? AND status='ringing'
            ORDER BY started_at DESC LIMIT 5
        """, (_user_id(),)).fetchall()
        return jsonify({'calls': [dict(c) for c in calls]})
    finally:
        conn.close()


@comm_bp.route('/calls/logs', methods=['GET'])
@login_required
def get_call_logs():
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        logs = conn.execute("""
            SELECT * FROM comm_calls
            WHERE caller_id=? OR callee_id=?
            ORDER BY started_at DESC LIMIT 50
        """, (_user_id(), _user_id())).fetchall()
        return jsonify({'logs': [dict(l) for l in logs]})
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────
# MEETINGS
# ─────────────────────────────────────────────────────────────────

@comm_bp.route('/meetings', methods=['GET'])
@login_required
def get_meetings():
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        uid = _user_id()
        # Meetings where user is host OR is in invite list
        rows = conn.execute("""
            SELECT * FROM comm_meetings ORDER BY scheduled_at DESC LIMIT 50
        """).fetchall()

        result = []
        for r in rows:
            m = dict(r)
            try:
                invites = json.loads(m.get('invite_json') or '[]')
            except Exception:
                invites = []
            if m['host_id'] == uid or uid in invites:
                m['invites'] = invites
                m['chat'] = json.loads(m.get('chat_json') or '[]')
                del m['invite_json'], m['chat_json']
                result.append(m)

        return jsonify({'meetings': result})
    finally:
        conn.close()


@comm_bp.route('/meetings/create', methods=['POST'])
@login_required
def create_meeting():
    if _role() not in ('admin', 'manager'):
        return jsonify({'error': 'Manager or Admin required'}), 403
    data = request.get_json() or {}
    title = data.get('title', 'Team Meeting')
    scheduled_at = data.get('scheduled_at')
    invites = data.get('invites', [])  # list of user_ids
    agenda = data.get('agenda', '')
    dept = data.get('department', _dept())

    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        if not _require_active(conn):
            return jsonify({'error': 'Communication system not activated'}), 403

        host = conn.execute("SELECT name FROM users WHERE id=?", (_user_id(),)).fetchone()
        room_code = _gen_room_code()

        conn.execute("""
            INSERT INTO comm_meetings (title, host_id, host_name, room_code, department,
                                       status, scheduled_at, invite_json, agenda)
            VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
        """, (title, _user_id(), host['name'] if host else 'Host',
               room_code, dept, scheduled_at,
               json.dumps(invites), agenda))
        conn.commit()
        meeting_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Notifications for invitees
        for uid in invites:
            try:
                conn.execute("""
                    INSERT INTO notifications (user_id, message, type, reference_id)
                    VALUES (?, ?, 'meeting', ?)
                """, (uid, f"You've been invited to meeting: {title}", meeting_id))
            except Exception:
                pass
        conn.commit()

        return jsonify({'success': True, 'meeting_id': meeting_id, 'room_code': room_code})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/start', methods=['POST'])
@login_required
def start_meeting(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        m = conn.execute("SELECT * FROM comm_meetings WHERE id=?", (meeting_id,)).fetchone()
        if not m:
            return jsonify({'error': 'Meeting not found'}), 404
        if m['host_id'] != _user_id() and _role() != 'admin':
            return jsonify({'error': 'Only host can start meeting'}), 403

        now = datetime.now().isoformat()
        conn.execute("UPDATE comm_meetings SET status='ongoing', started_at=? WHERE id=?", (now, meeting_id))

        # Add host as first participant
        conn.execute("""
            INSERT OR IGNORE INTO comm_meeting_participants (meeting_id, user_id, user_name, joined_at)
            SELECT ?, ?, name, ? FROM users WHERE id=?
        """, (meeting_id, _user_id(), now, _user_id()))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/join', methods=['POST'])
@login_required
def join_meeting(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        m = conn.execute("SELECT * FROM comm_meetings WHERE id=?", (meeting_id,)).fetchone()
        if not m:
            return jsonify({'error': 'Meeting not found'}), 404
        if m['status'] == 'ended':
            return jsonify({'error': 'Meeting has ended'}), 410

        now = datetime.now().isoformat()
        user = conn.execute("SELECT name FROM users WHERE id=?", (_user_id(),)).fetchone()

        # Add or update participant
        existing = conn.execute("""
            SELECT id FROM comm_meeting_participants WHERE meeting_id=? AND user_id=?
        """, (meeting_id, _user_id())).fetchone()

        if not existing:
            conn.execute("""
                INSERT INTO comm_meeting_participants (meeting_id, user_id, user_name, joined_at)
                VALUES (?, ?, ?, ?)
            """, (meeting_id, _user_id(), user['name'] if user else 'Guest', now))
        else:
            conn.execute("""
                UPDATE comm_meeting_participants SET joined_at=?, left_at=NULL WHERE id=?
            """, (now, existing['id']))

        conn.commit()
        return jsonify({'success': True, 'room_code': m['room_code']})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/leave', methods=['POST'])
@login_required
def leave_meeting(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        now = datetime.now().isoformat()
        conn.execute("""
            UPDATE comm_meeting_participants SET left_at=? WHERE meeting_id=? AND user_id=? AND left_at IS NULL
        """, (now, meeting_id, _user_id()))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/end', methods=['POST'])
@login_required
def end_meeting(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        m = conn.execute("SELECT * FROM comm_meetings WHERE id=?", (meeting_id,)).fetchone()
        if not m or (m['host_id'] != _user_id() and _role() != 'admin'):
            return jsonify({'error': 'Not authorized'}), 403
        now = datetime.now().isoformat()
        conn.execute("UPDATE comm_meetings SET status='ended', ended_at=? WHERE id=?", (now, meeting_id))
        conn.execute("""
            UPDATE comm_meeting_participants SET left_at=? WHERE meeting_id=? AND left_at IS NULL
        """, (now, meeting_id))
        conn.commit()
        return jsonify({'success': True})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/chat', methods=['POST'])
@login_required
def meeting_chat(meeting_id):
    data = request.get_json() or {}
    message = data.get('message', '').strip()
    if not message:
        return jsonify({'error': 'Empty message'}), 400

    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        m = conn.execute("SELECT chat_json FROM comm_meetings WHERE id=?", (meeting_id,)).fetchone()
        if not m:
            return jsonify({'error': 'Meeting not found'}), 404

        user = conn.execute("SELECT name FROM users WHERE id=?", (_user_id(),)).fetchone()
        chat = json.loads(m['chat_json'] or '[]')
        chat.append({
            'user_id': _user_id(),
            'name': user['name'] if user else 'User',
            'message': message,
            'time': datetime.now().strftime('%H:%M')
        })

        conn.execute("UPDATE comm_meetings SET chat_json=? WHERE id=?", (json.dumps(chat), meeting_id))
        conn.commit()
        return jsonify({'success': True, 'chat': chat})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>/participants', methods=['GET'])
@login_required
def get_participants(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        parts = conn.execute("""
            SELECT * FROM comm_meeting_participants WHERE meeting_id=? AND left_at IS NULL
        """, (meeting_id,)).fetchall()
        return jsonify({'participants': [dict(p) for p in parts]})
    finally:
        conn.close()


@comm_bp.route('/meetings/<int:meeting_id>', methods=['GET'])
@login_required
def get_meeting(meeting_id):
    domain = _domain()
    conn = get_conn(domain)
    try:
        ensure_comm_schema(conn)
        m = conn.execute("SELECT * FROM comm_meetings WHERE id=?", (meeting_id,)).fetchone()
        if not m:
            return jsonify({'error': 'Not found'}), 404
        result = dict(m)
        result['invites'] = json.loads(result.get('invite_json') or '[]')
        result['chat'] = json.loads(result.get('chat_json') or '[]')
        del result['invite_json'], result['chat_json']

        parts = conn.execute("""
            SELECT * FROM comm_meeting_participants WHERE meeting_id=? AND left_at IS NULL
        """, (meeting_id,)).fetchall()
        result['participants'] = [dict(p) for p in parts]

        return jsonify({'meeting': result})
    finally:
        conn.close()
