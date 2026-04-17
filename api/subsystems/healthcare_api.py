from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn
import json
from datetime import datetime

healthcare_bp = Blueprint('healthcare', __name__)

def _domain():
    return session.get('domain', 'healthcare')

def create_notification(conn, user_id, dept, msg, n_type, ref_id):
    conn.execute("""
        INSERT INTO notifications (user_id, department, message, type, reference_id)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, dept, msg, n_type, ref_id))

# ─── Dashboard Stats ───────────────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/dashboard-stats', methods=['GET'])
@login_required
def healthcare_dashboard_stats():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        stats = {}
        cur.execute("SELECT COUNT(*) FROM Health_Patient_Master")
        stats['total_patients'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Health_EHR_Records")
        stats['total_ehr_records'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Health_Surgeries_Intensive")
        stats['total_surgeries'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Health_Lab_Radiology WHERE is_critical_result = 1")
        stats['critical_labs'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Health_Medical_Insurance_Claims WHERE claim_status = 'pending'")
        stats['pending_claims'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Health_Medical_Insurance_Claims WHERE claim_status = 'approved'")
        stats['approved_claims'] = cur.fetchone()[0]
        cur.execute("SELECT SUM(approved_amount) FROM Health_Medical_Insurance_Claims WHERE claim_status = 'approved'")
        r = cur.fetchone()[0]; stats['total_claims_paid'] = round(r, 2) if r else 0.0
        cur.execute("SELECT COUNT(*) FROM Health_Surgeries_Intensive WHERE robotic_assistance_used = 1")
        stats['robotic_surgeries'] = cur.fetchone()[0]
        return jsonify({'stats': stats})
    finally:
        conn.close()


# ─── Patients ───────────────────────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/patients', methods=['POST', 'GET'])
@login_required
def handle_patients():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Health_Patient_Master 
                (user_id, blood_group_rh, genomic_summary_hash, organ_donor_status, 
                 emergency_contact_json, chronic_diseases_list, allergy_profiles_json, 
                 vaccination_history_json, current_medication_list, primary_physician_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('user_id'),
                data.get('blood_group_rh'),
                data.get('genomic_summary_hash', ''),
                1 if data.get('organ_donor_status') else 0,
                json.dumps(data.get('emergency_contact', {})),
                data.get('chronic_diseases_list', ''),
                json.dumps(data.get('allergy_profiles', [])),
                json.dumps(data.get('vaccination_history', [])),
                data.get('current_medication_list', ''),
                data.get('primary_physician_id')
            ))
            conn.commit()
            return jsonify({'success': True, 'patient_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Health_Patient_Master ORDER BY patient_id DESC")
            return jsonify({'patients': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── EHR Records ────────────────────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/ehr', methods=['POST', 'GET'])
@login_required
def handle_ehr():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Health_EHR_Records 
                (patient_id, doctor_id, visit_type, diagnosis_icd10_code, symptoms_narrative,
                 vitals_json, treatment_plan_text, follow_up_date, digital_signature_doctor)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('patient_id'),
                data.get('doctor_id'),
                data.get('visit_type'),
                data.get('diagnosis_icd10_code'),
                data.get('symptoms_narrative'),
                json.dumps(data.get('vitals', {})),
                data.get('treatment_plan_text'),
                data.get('follow_up_date'),
                data.get('digital_signature_doctor')
            ))
            conn.commit()
            return jsonify({'success': True, 'record_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Health_EHR_Records ORDER BY created_at DESC")
            return jsonify({'records': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Surgeries ──────────────────────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/surgeries', methods=['POST', 'GET'])
@login_required
def handle_surgeries():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Health_Surgeries_Intensive 
                (patient_id, lead_surgeon_id, anesthesiologist_id, surgery_type_category,
                 theater_id, robotic_assistance_used, blood_units_reserved, pre_op_clearance_status,
                 post_op_complication_notes, surgery_start_time, surgery_end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('patient_id'),
                data.get('lead_surgeon_id'),
                data.get('anesthesiologist_id'),
                data.get('surgery_type_category'),
                data.get('theater_id'),
                1 if data.get('robotic_assistance_used') else 0,
                data.get('blood_units_reserved', 0),
                1 if data.get('pre_op_clearance_status') else 0,
                data.get('post_op_complication_notes', ''),
                data.get('surgery_start_time'),
                data.get('surgery_end_time')
            ))
            conn.commit()
            return jsonify({'success': True, 'surgery_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Health_Surgeries_Intensive ORDER BY surgery_id DESC")
            return jsonify({'surgeries': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Medical Insurance Claims ───────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/claims', methods=['POST', 'GET'])
@login_required
def handle_claims():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Health_Medical_Insurance_Claims 
                (patient_id, insurance_provider_id, policy_number, claim_amount_requested,
                 approved_amount, deductible_paid_by_patient, denial_reason_code, claim_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('patient_id'),
                data.get('insurance_provider_id'),
                data.get('policy_number'),
                data.get('claim_amount_requested'),
                data.get('approved_amount', 0.0),
                data.get('deductible_paid_by_patient', 0.0),
                data.get('denial_reason_code', ''),
                data.get('claim_status', 'pending')
            ))
            conn.commit()
            return jsonify({'success': True, 'claim_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Health_Medical_Insurance_Claims ORDER BY claim_id DESC")
            return jsonify({'claims': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Lab Radiology ──────────────────────────────────────────────────────────
@healthcare_bp.route('/api/healthcare/labs', methods=['POST', 'GET'])
@login_required
def handle_labs():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            
            is_critical = 1 if data.get('is_critical_result') else 0
            
            cur.execute("""
                INSERT INTO Health_Lab_Radiology 
                (patient_id, test_category, imaging_file_url, radiologist_findings,
                 lab_values_json, is_critical_result)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get('patient_id'),
                data.get('test_category'),
                data.get('imaging_file_url', ''),
                data.get('radiologist_findings', ''),
                json.dumps(data.get('lab_values', {})),
                is_critical
            ))
            test_id = cur.lastrowid
            
            # Automated workflow trigger: Pinging doctor on critical test results
            if is_critical:
                cur.execute("SELECT primary_physician_id FROM Health_Patient_Master WHERE patient_id = ?", (data.get('patient_id'),))
                pt = cur.fetchone()
                # Target user or department
                doctor_user_id = pt['primary_physician_id'] if pt else None
                create_notification(conn, doctor_user_id, 'medical' if not doctor_user_id else None, 
                                  f"CRITICAL LAB RESULT: Test #{test_id} requires immediate review for Patient #{data.get('patient_id')}", 
                                  'alert', test_id)

            conn.commit()
            return jsonify({'success': True, 'test_id': test_id, 'alert_triggered': bool(is_critical)})
        else:
            cur.execute("SELECT * FROM Health_Lab_Radiology ORDER BY test_id DESC")
            return jsonify({'tests': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()
