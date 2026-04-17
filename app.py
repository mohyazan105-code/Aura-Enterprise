from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import timedelta
import os

try:
    from flask_compress import Compress
    _has_compress = True
except ImportError:
    _has_compress = False

from config import SECRET_KEY, BASE_DIR
from database.db_manager import init_all_domains

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = SECRET_KEY
app.permanent_session_lifetime = timedelta(hours=12)

# Enable gzip compression for all responses
if _has_compress:
    Compress(app)

CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')

# ── Register Blueprints ────────────────────────────────────────────────────────
from api.auth import auth_bp
from api.records import records_bp
from api.analytics import analytics_bp
from api.ai_api import ai_bp
from api.automation import rpa_bp
from api.admin import admin_bp
from api.loans import loans_bp
from api.workflows import workflows_bp
from api.reports import reports_bp
from api.communication import comm_bp
from api.performance import perf_bp, before_request_hook, after_request_hook
from api.builtit_api import m8dev_bp
from api.subsystems.accounting_api import accounting_bp
from api.subsystems.hr_api import hr_bp
from api.subsystems.inventory_api import inventory_bp
from api.subsystems.academics_api import academics_bp
from api.subsystems.healthcare_api import healthcare_bp
from api.subsystems.manufacturing_api import manufacturing_bp
from api.customer_portal import customer_portal_bp
from api.campaigns import campaigns_bp
from api.autopilot import autopilot_bp
from api.audit import audit_bp
from api.okr import okr_bp
from api.rbac_api import rbac_bp
from api.system_admin import system_admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(records_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(rpa_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(loans_bp)
app.register_blueprint(workflows_bp)
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(comm_bp, url_prefix='/api/comm')
app.register_blueprint(perf_bp)
app.register_blueprint(m8dev_bp)
app.register_blueprint(accounting_bp)
app.register_blueprint(hr_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(academics_bp)
app.register_blueprint(healthcare_bp)
app.register_blueprint(manufacturing_bp)
app.register_blueprint(customer_portal_bp)
app.register_blueprint(campaigns_bp)
app.register_blueprint(autopilot_bp)
app.register_blueprint(audit_bp)
app.register_blueprint(okr_bp)
app.register_blueprint(rbac_bp)
app.register_blueprint(system_admin_bp)

app.before_request(before_request_hook)
app.after_request(after_request_hook)

# ── Static asset caching ──────────────────────────────────────────────────────
@app.after_request
def add_cache_headers(response):
    """Add long-lived cache headers for static assets, no-store for API."""
    path = request.path
    if path.startswith('/static/'):
        response.cache_control.max_age = 2592000  # 30 days
        response.cache_control.public = True
    elif path.startswith('/api/'):
        response.cache_control.no_store = True
    return response

@app.route('/')
@app.route('/<path:path>')
def index(path=''):
    return render_template('index.html')


# ── Socket.IO Events ───────────────────────────────────────────────────────────
@socketio.on('connect')
def on_connect():
    emit('connected', {'msg': 'Aura AI connected'})


@socketio.on('subscribe_domain')
def on_subscribe(data):
    from flask_socketio import join_room
    domain = data.get('domain', 'banking')
    join_room(f"domain_{domain}")
    emit('subscribed', {'domain': domain})


@socketio.on('data_update')
def on_data_update(data):
    from flask_socketio import emit as semit
    domain = data.get('domain', 'banking')
    socketio.emit('refresh', data, room=f"domain_{domain}")


@socketio.on('comm_call_signal')
def on_comm_call(data):
    """Relay call signal to a specific user room."""
    from flask_socketio import join_room
    target = data.get('target_user_id')
    if target:
        socketio.emit('comm_incoming', data, room=f"user_{target}")


@socketio.on('comm_join_user_room')
def on_join_user_room(data):
    from flask_socketio import join_room
    user_id = data.get('user_id')
    if user_id:
        join_room(f"user_{user_id}")


# ── Error Handlers ─────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return render_template('index.html'), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error', 'detail': str(e)}), 500


# ── Startup ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("Initialize Action Aura Lite databases...")
    init_all_domains()
    print("All 4 domain databases ready.")
    from database.subsystem_db import init_all_subsystems
    init_all_subsystems()
    print("Starting server on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
