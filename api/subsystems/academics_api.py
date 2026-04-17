from flask import Blueprint, request, jsonify, session
from api.auth import login_required
from database.db_manager import get_conn
import json
from datetime import datetime

academics_bp = Blueprint('academics', __name__)

def _domain():
    return session.get('domain', 'education')

# ─── Dashboard Stats ────────────────────────────────────────────────────────
@academics_bp.route('/api/academics/dashboard-stats', methods=['GET'])
@login_required
def academics_dashboard_stats():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        stats = {}
        cur.execute("SELECT COUNT(*) FROM Edu_Students_Elite")
        stats['total_students'] = cur.fetchone()[0]
        cur.execute("SELECT AVG(cumulative_gpa) FROM Edu_Students_Elite WHERE cumulative_gpa > 0")
        r = cur.fetchone()[0]; stats['avg_gpa'] = round(r, 2) if r else 0.0
        cur.execute("SELECT COUNT(*) FROM Edu_Students_Elite WHERE graduation_status = 'probation'")
        stats['on_probation'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Edu_Students_Elite WHERE graduation_status = 'graduated'")
        stats['graduated'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Edu_Section_Enrollments")
        stats['total_enrollments'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Edu_Research_Grants_Portal")
        stats['active_grants'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Edu_Curriculum_Detailed")
        stats['total_courses'] = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM Edu_Exams_Proctored WHERE average_score < 50")
        stats['failing_exams'] = cur.fetchone()[0]
        return jsonify({'stats': stats})
    finally:
        conn.close()

# ─── curriculums ─────────────────────────────────────────────────────────────
@academics_bp.route('/api/academics/curriculums', methods=['POST', 'GET'])
@login_required
def handle_curriculums():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Edu_Curriculum_Detailed 
                (course_code, title_en, title_ar, credit_hours, is_lab_required, learning_outcomes_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get('course_code'),
                data.get('title_en'),
                data.get('title_ar'),
                data.get('credit_hours', 3),
                1 if data.get('is_lab_required') else 0,
                json.dumps(data.get('learning_outcomes', []))
            ))
            conn.commit()
            return jsonify({'success': True, 'course_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Edu_Curriculum_Detailed ORDER BY course_id DESC")
            courses = [dict(r) for r in cur.fetchall()]
            return jsonify({'courses': courses})
    finally:
        conn.close()

# ─── sections & enrollment ───────────────────────────────────────────────────
@academics_bp.route('/api/academics/sections', methods=['POST', 'GET'])
@login_required
def handle_sections():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Edu_Sections_Management 
                (course_id, instructor_id, semester_code, capacity_max, room_id, attendance_tracking_method)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data.get('course_id'),
                data.get('instructor_id'),
                data.get('semester_code', 'FALL2026'),
                data.get('capacity_max', 30),
                data.get('room_id'),
                data.get('attendance_tracking_method', 'Biometric')
            ))
            conn.commit()
            return jsonify({'success': True, 'section_id': cur.lastrowid})
        else:
            cur.execute("""
                SELECT s.*, c.title_en as course_name 
                FROM Edu_Sections_Management s
                JOIN Edu_Curriculum_Detailed c ON s.course_id = c.course_id
            """)
            sections = [dict(r) for r in cur.fetchall()]
            return jsonify({'sections': sections})
    finally:
        conn.close()

@academics_bp.route('/api/academics/enroll', methods=['POST'])
@login_required
def handle_enrollment():
    domain = _domain()
    data = request.get_json() or {}
    student_id = data.get('student_id')
    section_id = data.get('section_id')
    
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        
        # Check capacity
        cur.execute("SELECT capacity_max, current_enrolled_count FROM Edu_Sections_Management WHERE section_id = ?", (section_id,))
        sec = cur.fetchone()
        if not sec:
            return jsonify({'error': 'Section not found'}), 404
        if sec['current_enrolled_count'] >= sec['capacity_max']:
            return jsonify({'error': 'Section at max capacity'}), 400

        cur.execute("""
            INSERT INTO Edu_Section_Enrollments (student_id, section_id)
            VALUES (?, ?)
        """, (student_id, section_id))
        
        cur.execute("UPDATE Edu_Sections_Management SET current_enrolled_count = current_enrolled_count + 1 WHERE section_id = ?", (section_id,))
        
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ─── Exams ───────────────────────────────────────────────────────────────────
@academics_bp.route('/api/academics/exams', methods=['POST', 'GET'])
@login_required
def handle_exams():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Edu_Exams_Proctored 
                (section_id, exam_type, total_weight_percentage, exam_date, proctoring_system_logs_url)
                VALUES (?, ?, ?, ?, ?)
            """, (
                data.get('section_id'),
                data.get('exam_type', 'Midterm'),
                data.get('total_weight_percentage', 20.0),
                data.get('exam_date'),
                data.get('proctoring_system_logs_url', 'null')
            ))
            conn.commit()
            return jsonify({'success': True, 'exam_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Edu_Exams_Proctored ORDER BY exam_date DESC")
            return jsonify({'exams': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()

# ─── Research Portal ─────────────────────────────────────────────────────────
@academics_bp.route('/api/academics/grants', methods=['POST', 'GET'])
@login_required
def handle_grants():
    domain = _domain()
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        if request.method == 'POST':
            data = request.get_json() or {}
            cur.execute("""
                INSERT INTO Edu_Research_Grants_Portal 
                (principal_investigator_id, title_of_research, funding_agency, total_budget_approved, start_date)
                VALUES (?, ?, ?, ?, ?)
            """, (
                data.get('principal_investigator_id'),
                data.get('title_of_research'),
                data.get('funding_agency'),
                data.get('total_budget_approved'),
                data.get('start_date')
            ))
            conn.commit()
            return jsonify({'success': True, 'grant_id': cur.lastrowid})
        else:
            cur.execute("SELECT * FROM Edu_Research_Grants_Portal")
            return jsonify({'grants': [dict(r) for r in cur.fetchall()]})
    finally:
        conn.close()
