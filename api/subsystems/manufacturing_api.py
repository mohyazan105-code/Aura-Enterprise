from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn
import json
from datetime import datetime

manufacturing_bp = Blueprint('manufacturing', __name__)

def _domain():
    return session.get('domain', 'manufacturing')

def create_notification(conn, user_id, dept, msg, n_type, ref_id):
    conn.execute("""
        INSERT INTO notifications (user_id, department, message, type, reference_id)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, dept, msg, n_type, ref_id))

# ─── Dashboard Stats ───────────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/dashboard-stats', methods=['GET'])
@login_required
def manufacturing_dashboard_stats():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        stats = {}
        cur.execute("SELECT AVG(cycle_efficiency_score) FROM Mfg_Production_Cycles WHERE cycle_status = 'completed'")
        r = cur.fetchone()[0]; stats['avg_efficiency'] = round(r, 2) if r else 0.0
        cur.execute("SELECT COUNT(*) FROM Mfg_Production_Cycles WHERE cycle_status = 'active'")
        stats['active_cycles'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Mfg_IoT_Sensors_Network WHERE is_alert_triggered = 1")
        stats['iot_alerts'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Mfg_IoT_Sensors_Network")
        stats['total_sensors'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Mfg_Quality_Assurance_AI WHERE inspection_outcome = 'fail'")
        stats['qa_failures'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Mfg_Products_Master")
        stats['total_products'] = cur.fetchone()[0]
        cur.execute("SELECT SUM(waste_quantity) FROM Mfg_Production_Cycles")
        r = cur.fetchone()[0]; stats['total_waste'] = int(r) if r else 0
        cur.execute("SELECT COUNT(*) FROM Mfg_Supply_Chain_Global")
        stats['supply_entries'] = cur.fetchone()[0]
        return jsonify({'stats': stats})
    finally:
        conn.close()

# ─── Products Master ────────────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/products', methods=['POST', 'GET'])
@login_required
def handle_products():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Mfg_Products_Master 
                (sku_code, product_name, category_id, base_manufacturing_cost, 
                 retail_price_suggested, weight_kg, dimensions_json, is_customizable)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('sku_code'),
                data.get('product_name'),
                data.get('category_id'),
                data.get('base_manufacturing_cost'),
                data.get('retail_price_suggested'),
                data.get('weight_kg'),
                json.dumps(data.get('dimensions_json', {})),
                1 if data.get('is_customizable') else 0
            ))
            conn.commit()
            return jsonify({'success': True, 'product_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Mfg_Products_Master ORDER BY product_id DESC")
            return jsonify({'products': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Production Cycles ──────────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/cycles', methods=['POST', 'GET'])
@login_required
def handle_cycles():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Mfg_Production_Cycles 
                (product_id, production_line_id, planned_quantity, actual_produced_quantity,
                 waste_quantity, start_timestamp, end_timestamp, cycle_efficiency_score, cycle_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('product_id'),
                data.get('production_line_id'),
                data.get('planned_quantity'),
                data.get('actual_produced_quantity', 0),
                data.get('waste_quantity', 0),
                data.get('start_timestamp'),
                data.get('end_timestamp'),
                data.get('cycle_efficiency_score', 0.0),
                data.get('cycle_status', 'planned')
            ))
            conn.commit()
            return jsonify({'success': True, 'cycle_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Mfg_Production_Cycles ORDER BY start_timestamp DESC")
            return jsonify({'cycles': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Supply Chain Global ────────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/supply-chain', methods=['POST', 'GET'])
@login_required
def handle_supply_chain():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Mfg_Supply_Chain_Global 
                (material_id, supplier_id, batch_tracking_number, carbon_footprint_kg,
                 lead_time_days, shipment_gps_tracking_url, customs_duty_paid)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('material_id'),
                data.get('supplier_id'),
                data.get('batch_tracking_number'),
                data.get('carbon_footprint_kg', 0.0),
                data.get('lead_time_days', 0),
                data.get('shipment_gps_tracking_url', ''),
                data.get('customs_duty_paid', 0.0)
            ))
            conn.commit()
            return jsonify({'success': True, 'supply_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Mfg_Supply_Chain_Global ORDER BY supply_id DESC")
            return jsonify({'supplies': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Quality Assurance AI ───────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/qa', methods=['POST', 'GET'])
@login_required
def handle_qa():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            defects = data.get('defect_detected_count', 0)
            cur.execute("""
                INSERT INTO Mfg_Quality_Assurance_AI 
                (cycle_id, ai_model_version, defect_detected_count, images_scan_url_json,
                 inspection_outcome, inspector_human_override_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get('cycle_id'),
                data.get('ai_model_version', 'v1.0'),
                defects,
                json.dumps(data.get('images_scan_url_json', [])),
                data.get('inspection_outcome', 'pass' if defects == 0 else 'fail'),
                data.get('inspector_human_override_id')
            ))
            qa_id = cur.lastrowid
            
            # QA Automation: Alert on high defects
            if defects > 5:
                create_notification(conn, None, 'operations', 
                                    f"QA ALERT: {defects} defects detected in cycle {data.get('cycle_id')}", 
                                    'alert', qa_id)
            conn.commit()
            return jsonify({'success': True, 'qa_id': qa_id})
        else:
            cur.execute("SELECT * FROM Mfg_Quality_Assurance_AI ORDER BY qa_id DESC")
            return jsonify({'inspections': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── IoT Sensors Network ────────────────────────────────────────────────────
@manufacturing_bp.route('/api/manufacturing/iot-sensors', methods=['POST', 'GET'])
# Notice: In a real environment, IoT endpoints might use API Keys instead of session login,
# but using @login_required for uniformity in this prototype.
@login_required
def handle_iot_sensors():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            
            reading = float(data.get('real_time_reading', 0.0))
            threshold = float(data.get('threshold_limit_max', 100.0))
            
            is_alert = 1 if reading > threshold else 0
            
            cur.execute("""
                INSERT INTO Mfg_IoT_Sensors_Network 
                (machine_id, sensor_type, real_time_reading, threshold_limit_max,
                 last_maintenance_timestamp, iot_firmware_version, is_alert_triggered)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('machine_id'),
                data.get('sensor_type'),
                reading,
                threshold,
                data.get('last_maintenance_timestamp'),
                data.get('iot_firmware_version', 'v2.1'),
                is_alert
            ))
            sensor_id = cur.lastrowid
            
            # RPA Hook: IoT Threshold Overrun
            if is_alert:
                create_notification(conn, None, 'operations', 
                                    f"CRITICAL MACHINE ALERT: Machine {data.get('machine_id')} exceeded threshold! Reading: {reading} > Limit: {threshold}", 
                                    'alert', sensor_id)
            
            conn.commit()
            return jsonify({'success': True, 'sensor_id': sensor_id, 'alert_triggered': bool(is_alert)})
        else:
            cur.execute("SELECT * FROM Mfg_IoT_Sensors_Network ORDER BY sensor_id DESC LIMIT 50")
            return jsonify({'sensors': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()
