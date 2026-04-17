import sqlite3
import os
import json
import math
import random
import hashlib
from datetime import datetime, timedelta
from config import DATABASE_DIR, DOMAINS, DEPARTMENTS, DEFAULT_USERS, ROLES, CORE_EMPLOYEE_DATA

os.makedirs(DATABASE_DIR, exist_ok=True)


def get_conn(domain: str):
    db_path = DOMAINS[domain]['db']
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


# ─── Schema ───────────────────────────────────────────────────────────────────

SCHEMA = """
-- Roles & Permissions (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    level INTEGER NOT NULL,
    color TEXT DEFAULT '#1a73e8',
    built_in INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    module TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS domain_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_name TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    config_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action_type TEXT NOT NULL,
    module TEXT,
    details TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Users (shared within domain)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER,
    status TEXT DEFAULT 'active',
    name TEXT,
    email TEXT,
    department TEXT,
    avatar_color TEXT DEFAULT '#1a73e8',
    ui_preferences TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
);

-- HR
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE,
    name TEXT NOT NULL,
    department TEXT,
    position TEXT,
    email TEXT,
    phone TEXT,
    salary REAL,
    hire_date TEXT,
    status TEXT DEFAULT 'active',
    manager_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    type TEXT,
    start_date TEXT,
    end_date TEXT,
    days INTEGER,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    approved_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    month TEXT,
    base_salary REAL,
    bonus REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_salary REAL,
    status TEXT DEFAULT 'pending',
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    period TEXT,
    score REAL,
    kpi_achieved INTEGER,
    kpi_total INTEGER,
    notes TEXT,
    reviewed_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Finance
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    client TEXT,
    amount REAL,
    tax REAL DEFAULT 0,
    total REAL,
    status TEXT DEFAULT 'draft',
    due_date TEXT,
    paid_date TEXT,
    department TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT,
    period TEXT,
    allocated REAL,
    spent REAL DEFAULT 0,
    remaining REAL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    description TEXT,
    amount REAL,
    department TEXT,
    submitted_by INTEGER,
    status TEXT DEFAULT 'pending',
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    reference TEXT,
    description TEXT,
    amount REAL,
    debit_account TEXT,
    credit_account TEXT,
    department TEXT,
    date TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    severity TEXT DEFAULT 'low',
    department TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    resolved_at TEXT,
    reported_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    department TEXT,
    target REAL,
    actual REAL,
    unit TEXT,
    period TEXT,
    status TEXT,
    trend TEXT DEFAULT 'stable',
    created_at TEXT DEFAULT (datetime('now'))
);

-- CRM
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    password_hash TEXT,
    company TEXT,
    type TEXT DEFAULT 'individual',
    status TEXT DEFAULT 'active',
    assigned_to INTEGER,
    value REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT UNIQUE,
    customer_id INTEGER,
    title TEXT,
    category TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    assigned_to INTEGER,
    resolution TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    score INTEGER DEFAULT 0,
    assigned_to INTEGER,
    estimated_value REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Sales
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    customer_id INTEGER,
    stage TEXT DEFAULT 'prospecting',
    value REAL,
    probability INTEGER DEFAULT 10,
    expected_close TEXT,
    assigned_to INTEGER,
    status TEXT DEFAULT 'active',
    won_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    budget REAL,
    spent REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    target_audience TEXT,
    status TEXT DEFAULT 'draft',
    leads_generated INTEGER DEFAULT 0,
    roi REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Project Management
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    department TEXT,
    manager_id INTEGER,
    budget REAL,
    spent REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'planning',
    completion INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'pending',
    completion INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Analytics
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    department TEXT,
    filters TEXT,
    data TEXT,
    created_by INTEGER,
    is_scheduled INTEGER DEFAULT 0,
    schedule_cron TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    department TEXT,
    value REAL,
    unit TEXT,
    period TEXT,
    date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Logistics
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    unit TEXT,
    min_stock INTEGER DEFAULT 10,
    unit_cost REAL,
    department TEXT,
    location TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    category TEXT,
    reliability_score REAL DEFAULT 100,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT UNIQUE,
    carrier TEXT,
    origin TEXT,
    destination TEXT,
    status TEXT DEFAULT 'pending',
    estimated_arrival TEXT,
    actual_arrival TEXT,
    cost REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- AI / Decisions
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT,
    department TEXT,
    title TEXT,
    context TEXT,
    options TEXT, -- JSON
    chosen_option TEXT,
    probabilities TEXT, -- JSON success scores
    outcome TEXT,
    success_score REAL,
    decided_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- RPA
CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    steps TEXT,
    trigger_type TEXT DEFAULT 'manual',
    trigger_condition TEXT,
    status TEXT DEFAULT 'active',
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_run TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER,
    status TEXT,
    duration_ms INTEGER,
    result TEXT,
    run_at TEXT DEFAULT (datetime('now'))
);

-- Loan Workflow
CREATE TABLE IF NOT EXISTS loan_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    term_months INTEGER,
    purpose TEXT,
    status TEXT DEFAULT 'pending_op', -- pending_op, rejected_op, pending_finance, approved, rejected_finance
    op_comment TEXT,
    finance_comment TEXT,
    op_reviewed_by INTEGER,
    finance_reviewed_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
);

-- Workflow System
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    department TEXT NOT NULL,
    trigger_desc TEXT,
    steps_json TEXT, -- All steps and rules
    kpi_json TEXT,
    tracking_type TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    from_dept TEXT,
    to_dept TEXT,
    approval_role TEXT,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'pending',
    assigned_to INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    definition_id INTEGER,
    customer_id INTEGER, -- Optional (internal vs external)
    current_step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, active, completed, rejected, more_info
    data_json TEXT, -- Instance-specific data (amounts, comments, etc)
    history_json TEXT, -- Timeline of actions taken
    assigned_dept TEXT,
    assigned_user INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(definition_id) REFERENCES workflow_definitions(id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Staff user
    department TEXT, -- Target department
    message TEXT,
    type TEXT, -- loan_app, alert, etc.
    reference_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ── Intelligence Layer ─────────────────────────────────────────────────────────

-- Persisted learned patterns (updated by learning loop)
CREATE TABLE IF NOT EXISTS ai_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    department TEXT,
    pattern_type TEXT NOT NULL,  -- trend | anomaly | cluster | forecast | association | process
    metric TEXT,
    value_json TEXT,             -- JSON serialized pattern data
    confidence REAL DEFAULT 0.0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Time-series predictions per domain/department/metric
CREATE TABLE IF NOT EXISTS ai_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    department TEXT,
    metric TEXT NOT NULL,
    period TEXT NOT NULL,        -- e.g. '2026-05'
    predicted_value REAL,
    confidence_low REAL,
    confidence_high REAL,
    actual_value REAL,           -- filled retrospectively
    accuracy REAL,               -- calculated when actual arrives
    model TEXT DEFAULT 'linear', -- linear | moving_avg | ensemble
    created_at TEXT DEFAULT (datetime('now'))
);

-- Custom user-defined KPIs (role and department scoped)
CREATE TABLE IF NOT EXISTS kpi_custom (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT DEFAULT 'all',     -- role that sees this KPI
    name TEXT NOT NULL,
    formula TEXT,                -- description of how it's computed
    target REAL,
    unit TEXT DEFAULT '%',
    icon TEXT DEFAULT '📊',
    color TEXT DEFAULT '#1a73e8',
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reporting System
CREATE TABLE IF NOT EXISTS report_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    sections_json TEXT, -- Default sections/metrics
    domain_scope TEXT, -- all | specific domain
    role_scope TEXT DEFAULT 'all'
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    title TEXT NOT NULL,
    generated_by INTEGER,
    assigned_to_user INTEGER,
    assigned_to_dept TEXT,
    domain TEXT NOT NULL,
    department TEXT,
    status TEXT DEFAULT 'pending', -- pending | viewed
    payload_json TEXT, -- The snapshot data
    ai_insights_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(template_id) REFERENCES report_templates(id)
);

-- Education Specific
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE,
    name TEXT,
    gender TEXT,
    school_type TEXT,
    family_income TEXT,
    parental_education_level TEXT,
    distance_from_home TEXT,
    learning_disabilities TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    hours_studied INTEGER,
    attendance INTEGER,
    parental_involvement TEXT,
    access_to_resources TEXT,
    extracurricular_activities TEXT,
    sleep_hours INTEGER,
    previous_scores INTEGER,
    motivation_level TEXT,
    internet_access TEXT,
    tutoring_sessions INTEGER,
    teacher_quality TEXT,
    peer_influence TEXT,
    physical_activity INTEGER,
    exam_score INTEGER,
    recorded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(student_id) REFERENCES students(id)
);

-- Adaptive Experience Learning System
CREATE TABLE IF NOT EXISTS user_ai_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    department TEXT,
    efficiency_score REAL DEFAULT 50.0,
    preferred_workflows_json TEXT DEFAULT '[]',
    learned_habits_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type TEXT,
    context TEXT,
    outcome TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contact_suggestions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    suggested_user_id INTEGER,
    intent TEXT,
    was_accepted INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT (datetime('now'))
);
"""

BANKING_SCHEMA = """
CREATE TABLE IF NOT EXISTS Bank_Accounts (
    acc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    branch_id INTEGER,
    account_no TEXT,
    iban_code TEXT,
    swift_bic TEXT,
    account_type TEXT,
    account_tier TEXT,
    currency_id TEXT,
    balance_ledger REAL,
    balance_available REAL,
    unrealized_gains_losses REAL,
    interest_rate_apy REAL,
    overdraft_limit REAL,
    daily_transfer_limit REAL,
    kyc_status TEXT,
    is_multisig INTEGER,
    account_status TEXT,
    opening_date TEXT,
    last_activity_at TEXT
);

CREATE TABLE IF NOT EXISTS Bank_Transactions_Detail (
    trans_id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account_id INTEGER,
    to_account_id INTEGER,
    amount_original_curr REAL,
    exchange_rate_applied REAL,
    fee_json TEXT,  -- JSON containing fee breakdowns
    trans_category TEXT,
    trans_status TEXT,
    transaction_hash_ref TEXT,
    merchant_id INTEGER,
    location_gps TEXT,
    ip_address TEXT,
    fraud_score REAL,
    description_text TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Bank_Credit_Cards_Master (
    card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    card_brand TEXT,
    card_number_masked TEXT,
    expiry_date TEXT,
    cvv_encrypted TEXT,
    credit_limit_assigned REAL,
    current_outstanding_balance REAL,
    reward_points_balance INTEGER,
    is_contactless_enabled INTEGER,
    card_status TEXT
);

CREATE TABLE IF NOT EXISTS Bank_Loans_Advanced (
    loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    loan_product_type TEXT,
    principal_amount REAL,
    interest_rate_fixed_variable REAL,
    amortization_period_months INTEGER,
    next_payment_date TEXT,
    total_paid_to_date REAL DEFAULT 0.0,
    remaining_balance REAL,
    late_fee_percentage REAL,
    credit_score_on_approval INTEGER,
    loan_status TEXT
);

CREATE TABLE IF NOT EXISTS Bank_Collaterals_Vault (
    collateral_id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER,
    asset_class TEXT,
    asset_valuation_market REAL,
    last_appraisal_date TEXT,
    appraisal_agency_name TEXT,
    legal_ownership_doc_url TEXT,
    insurance_coverage_ref TEXT
);

-- Campaigns Data Models
CREATE TABLE IF NOT EXISTS campaign_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    reward_amount REAL,
    min_balance REAL,
    min_volume REAL,
    status TEXT DEFAULT 'draft', -- draft, active, finished
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    account_id INTEGER, -- Reference to Bank_Accounts.acc_id
    status TEXT DEFAULT 'qualified', -- qualified, pending_verification, approved, rejected, completed
    fraud_score REAL DEFAULT 0,
    risk_level TEXT DEFAULT 'low',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(campaign_id) REFERENCES campaign_definitions(id)
);

CREATE TABLE IF NOT EXISTS campaign_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    submitted_name TEXT,
    submitted_account TEXT,
    match_score REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(participant_id) REFERENCES campaign_participants(id)
);

CREATE TABLE IF NOT EXISTS campaign_fraud_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    alert_type TEXT,
    severity TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

def ensure_banking_schema(conn):
    """Dynamically applies the Advanced Banking ERD tables."""
    conn.executescript(BANKING_SCHEMA)
    conn.commit()

EDUCATION_SCHEMA = """
CREATE TABLE IF NOT EXISTS Edu_Curriculum_Detailed (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT,
    title_ar TEXT,
    title_en TEXT,
    department_id INTEGER,
    credit_hours INTEGER,
    learning_outcomes_json TEXT,  -- JSONB substitute
    is_lab_required INTEGER,
    prerequisites_json TEXT,
    syllabus_pdf_url TEXT
);

CREATE TABLE IF NOT EXISTS Edu_Students_Elite (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    major_id INTEGER,
    advisor_id INTEGER,
    academic_year_level INTEGER,
    cumulative_gpa REAL,
    rank_in_cohort INTEGER,
    total_credits_earned INTEGER,
    probation_history_json TEXT,
    scholarship_amount_annual REAL,
    extracurricular_points INTEGER,
    graduation_status TEXT
);

CREATE TABLE IF NOT EXISTS Edu_Sections_Management (
    section_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    instructor_id INTEGER,
    semester_code TEXT,
    capacity_max INTEGER,
    current_enrolled_count INTEGER DEFAULT 0,
    room_id INTEGER,
    schedule_slots_json TEXT,
    attendance_tracking_method TEXT
);

CREATE TABLE IF NOT EXISTS Edu_Research_Grants_Portal (
    grant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    principal_investigator_id INTEGER,
    title_of_research TEXT,
    funding_agency TEXT,
    total_budget_approved REAL,
    ethics_committee_approval_no TEXT,
    publication_count INTEGER,
    start_date TEXT
);

CREATE TABLE IF NOT EXISTS Edu_Exams_Proctored (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER,
    exam_type TEXT,
    total_weight_percentage REAL,
    average_score REAL,
    highest_score REAL,
    proctoring_system_logs_url TEXT,
    exam_date TEXT
);

CREATE TABLE IF NOT EXISTS Edu_Section_Enrollments (
    enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    section_id INTEGER,
    final_grade TEXT,
    total_score REAL,
    attendance_rate REAL
);
"""

def ensure_education_schema(conn):
    """Dynamically applies the Advanced Education ERD tables."""
    conn.executescript(EDUCATION_SCHEMA)
    conn.commit()

HEALTHCARE_SCHEMA = """
CREATE TABLE IF NOT EXISTS Health_Patient_Master (
    patient_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    blood_group_rh TEXT,
    genomic_summary_hash TEXT,
    organ_donor_status INTEGER,
    emergency_contact_json TEXT,  -- jsonb
    chronic_diseases_list TEXT,
    allergy_profiles_json TEXT,   -- jsonb
    vaccination_history_json TEXT,-- jsonb
    current_medication_list TEXT,
    primary_physician_id INTEGER
);

CREATE TABLE IF NOT EXISTS Health_EHR_Records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    doctor_id INTEGER,
    visit_type TEXT,
    diagnosis_icd10_code TEXT,
    symptoms_narrative TEXT,
    vitals_json TEXT,             -- jsonb
    treatment_plan_text TEXT,
    follow_up_date TEXT,
    digital_signature_doctor TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Health_Surgeries_Intensive (
    surgery_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    lead_surgeon_id INTEGER,
    anesthesiologist_id INTEGER,
    surgery_type_category TEXT,
    theater_id INTEGER,
    robotic_assistance_used INTEGER,
    blood_units_reserved INTEGER,
    pre_op_clearance_status INTEGER,
    post_op_complication_notes TEXT,
    surgery_start_time TEXT,
    surgery_end_time TEXT
);

CREATE TABLE IF NOT EXISTS Health_Medical_Insurance_Claims (
    claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    insurance_provider_id INTEGER,
    policy_number TEXT,
    claim_amount_requested REAL,
    approved_amount REAL,
    deductible_paid_by_patient REAL,
    denial_reason_code TEXT,
    claim_status TEXT
);

CREATE TABLE IF NOT EXISTS Health_Lab_Radiology (
    test_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    test_category TEXT,
    imaging_file_url TEXT,
    radiologist_findings TEXT,
    lab_values_json TEXT,         -- jsonb
    is_critical_result INTEGER
);
"""

def ensure_healthcare_schema(conn):
    """Dynamically applies the Advanced Healthcare ERD tables."""
    conn.executescript(HEALTHCARE_SCHEMA)
    conn.commit()

MANUFACTURING_SCHEMA = """
CREATE TABLE IF NOT EXISTS Mfg_Products_Master (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_code TEXT,
    product_name TEXT,
    category_id INTEGER,
    base_manufacturing_cost REAL,
    retail_price_suggested REAL,
    weight_kg REAL,
    dimensions_json TEXT,  -- jsonb
    is_customizable INTEGER
);

CREATE TABLE IF NOT EXISTS Mfg_Production_Cycles (
    cycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    production_line_id INTEGER,
    planned_quantity INTEGER,
    actual_produced_quantity INTEGER,
    waste_quantity INTEGER,
    start_timestamp TEXT,
    end_timestamp TEXT,
    cycle_efficiency_score REAL,
    cycle_status TEXT
);

CREATE TABLE IF NOT EXISTS Mfg_Supply_Chain_Global (
    supply_id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER,
    supplier_id INTEGER,
    batch_tracking_number TEXT,
    carbon_footprint_kg REAL,
    lead_time_days INTEGER,
    shipment_gps_tracking_url TEXT,
    customs_duty_paid REAL
);

CREATE TABLE IF NOT EXISTS Mfg_Quality_Assurance_AI (
    qa_id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id INTEGER,
    ai_model_version TEXT,
    defect_detected_count INTEGER,
    images_scan_url_json TEXT, -- jsonb
    inspection_outcome TEXT,
    inspector_human_override_id INTEGER
);

CREATE TABLE IF NOT EXISTS Mfg_IoT_Sensors_Network (
    sensor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER,
    sensor_type TEXT,
    real_time_reading REAL,
    threshold_limit_max REAL,
    last_maintenance_timestamp TEXT,
    iot_firmware_version TEXT,
    is_alert_triggered INTEGER
);
"""

def ensure_manufacturing_schema(conn):
    """Dynamically applies the Advanced Manufacturing ERD tables."""
    conn.executescript(MANUFACTURING_SCHEMA)
    conn.commit()




def ensure_learning_schema(conn):
    """Dynamically applies the AI learning tables if they don't exist in existing DBs."""
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS user_ai_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        department TEXT,
        efficiency_score REAL DEFAULT 50.0,
        preferred_workflows_json TEXT DEFAULT '[]',
        learned_habits_json TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS user_action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action_type TEXT,
        context TEXT,
        outcome TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS contact_suggestions_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        suggested_user_id INTEGER,
        intent TEXT,
        was_accepted INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()


def ensure_kpi_schema(conn):
    """Dynamically applies the KPI Definitions table."""
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS kpi_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        definition TEXT,
        purpose TEXT,
        formula TEXT,
        data_source TEXT,
        updated_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)
    conn.commit()


def init_domain_db(domain: str):
    """Initialize DB schema and seed data for a domain."""
    conn = get_conn(domain)
    conn.executescript(SCHEMA)
    
    if domain.lower() == 'banking':
        ensure_banking_schema(conn)
    elif domain.lower() == 'education':
        ensure_education_schema(conn)
    elif domain.lower() == 'healthcare':
        ensure_healthcare_schema(conn)
    elif domain.lower() == 'manufacturing':
        ensure_manufacturing_schema(conn)
    
    try:
        conn.execute("ALTER TABLE users ADD COLUMN ui_preferences TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    conn.commit()
    _seed_users(conn, domain)
    _seed_workflows(conn, domain)
    _seed_tasks(conn, domain)
    _seed_report_templates(conn, domain)
    _seed_sample_data(conn, domain)
    conn.close()


def _seed_report_templates(conn, domain):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM report_templates")
    if cur.fetchone()[0] > 0:
        return
    
    templates = [
        {"name": "Performance Report", "description": "High-level overview of department and domain performance.", "sections": ["KPIs", "Metrics", "AI Summary"]},
        {"name": "Financial Summary Report", "description": "Comprehensive financial review including revenue and budgets.", "sections": ["Revenue", "Expenses", "Budgets", "Invoices"]},
        {"name": "Sales & Revenue Report", "description": "Analysis of sales deals, transactions, and revenue trends.", "sections": ["Deals", "Transactions", "Revenue Trend"]},
        {"name": "Marketing Campaign Report", "description": "Tracking of leads, campaign effectiveness, and ROI.", "sections": ["Leads", "Campaign Performance", "ROI"]},
        {"name": "Operational Efficiency Report", "description": "Workflow speed, task completion, and resource utilization.", "sections": ["Tasks", "Workflow Speed", "Resource Utilization"]},
        {"name": "Employee Performance Report", "description": "Individual and team performance, leaves, and payroll.", "sections": ["Leaves", "Payroll", "Manager Feedback"]},
        {"name": "KPI Tracking Report", "description": "Detailed tracking of predefined KPIs against targets.", "sections": ["Historical KPIs", "Target vs Actual"]},
        {"name": "Risk & Anomaly Report", "description": "Identification of data anomalies and business risks.", "sections": ["Anomalies", "Risk Indicators", "Forecast"]},
        {"name": "Workflow Activity Report", "description": "Real-time status of all active processes and bottlenecks.", "sections": ["Current Workflows", "Bottlenecks", "Duration Analysis"]},
        {"name": "Forecast & Prediction Report", "description": "AI-powered future trend analysis and predictions.", "sections": ["Future Trends", "Churn Risk", "Clustering"]}
    ]
    
    for t in templates:
        cur.execute("""
            INSERT INTO report_templates (name, description, sections_json, domain_scope)
            VALUES (?, ?, ?, 'all')
        """, (t['name'], t['description'], json.dumps(t['sections'])))
    conn.commit()


def _seed_workflows(conn, domain):
    """Seed the 20 specialized enterprise workflows."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM workflow_definitions")
    if cur.fetchone()[0] > 0:
        return
    
    # Process definitions from user request
    processes = [
        # Banking
        {"id": 1, "domain": "Banking", "department": "finance", "name": "Loan Application", "trigger": "Customer submits loan request", 
         "steps": [{"step": 1, "name": "Submission", "actor": "Customer"}, {"step": 2, "name": "Initial Review", "actor": "operator"}, {"step": 3, "name": "Final Review", "actor": "finance"}, {"step": 4, "name": "Decision", "actor": "system"}], "kpi": ["Approval Rate", "Processing Time"], "tracking": "Status Tracker + Timeline"},
        {"id": 2, "domain": "Banking", "department": "hr", "name": "Employee Hiring", "trigger": "New vacancy created", 
         "steps": [{"step": 1, "action": "Post Job"}, {"step": 2, "action": "Review"}, {"step": 3, "action": "Approve"}, {"step": 4, "action": "Offer"}], "kpi": ["Time to Hire"], "tracking": "Hiring Pipeline"},
        {"id": 6, "domain": "Banking", "department": "marketing", "name": "Credit Card Campaign", "steps": ["Create","Approve","Launch","Track"], "kpi": ["Leads"]},
        {"id": 7, "domain": "Banking", "department": "logistics", "name": "Document Transfer", "steps": ["Request","Approve","Transfer","Confirm"], "kpi": ["Speed"]},
        {"id": 14, "domain": "Banking", "department": "pm", "name": "System Upgrade Project", "steps": ["Plan","Approve","Execute","Close"], "kpi": ["Completion Rate"]},
        {"id": 18, "domain": "Banking", "department": "finance", "name": "Fraud Detection Review", "steps": ["Detect","Review","Approve Action"], "kpi": ["Fraud Rate"]},
        
        # Healthcare
        {"id": 3, "domain": "Healthcare", "department": "logistics", "name": "Medical Supply Request", "trigger": "Low inventory detected", 
         "steps": [{"step": 1, "action": "Alert"}, {"step": 2, "action": "Approve"}, {"step": 3, "action": "Budget"}, {"step": 4, "action": "Order"}], "kpi": ["Stock Availability"], "tracking": "Inventory Dashboard"},
        {"id": 8, "domain": "Healthcare", "department": "hr", "name": "Staff Scheduling", "steps": ["Create","Assign","Approve","Publish"], "kpi": ["Coverage"]},
        {"id": 9, "domain": "Healthcare", "department": "finance", "name": "Patient Billing", "steps": ["Generate","Review","Approve","Send"], "kpi": ["Revenue"]},
        {"id": 15, "domain": "Healthcare", "department": "pm", "name": "New Department Setup", "steps": ["Plan","Approve","Execute","Monitor"], "kpi": ["Setup Time"]},
        {"id": 19, "domain": "Healthcare", "department": "marketing", "name": "Health Awareness Campaign", "steps": ["Plan","Approve","Launch"], "kpi": ["Engagement"]},

        # Education
        {"id": 4, "domain": "Education", "department": "academics", "name": "At-Risk Student Intervention", "trigger": "Exam score < 60 or Attendance < 70%", 
         "steps": [{"step": 1, "action": "Flag Student"}, {"step": 2, "action": "Advisor Review"}, {"step": 3, "action": "Schedule Tutoring"}, {"step": 4, "action": "Monitor Progress"}], "kpi": ["Recovery Rate"], "tracking": "Student Timeline"},
        {"id": 10, "domain": "Education", "department": "academics", "name": "Tutoring Allocation", "steps": ["Request","Review Eligibility","Assign Tutor","Track Sessions"], "kpi": ["Tutoring Success Rate"]},
        {"id": 11, "domain": "Education", "department": "finance", "name": "Tuition Collection", "steps": ["Invoice","Notify","Collect","Confirm"], "kpi": ["Collection Rate"]},
        {"id": 16, "domain": "Education", "department": "academics", "name": "Resource Distribution", "steps": ["Assess Need","Approve","Distribute","Evaluate"], "kpi": ["Access Equity"]},

        # Manufacturing
        {"id": 5, "domain": "Manufacturing", "department": "pm", "name": "Production Planning", "trigger": "New production order", 
         "steps": [{"step": 1, "action": "Plan"}, {"step": 2, "action": "Approve"}, {"step": 3, "action": "Prepare"}, {"step": 4, "action": "Execute"}], "kpi": ["Production Efficiency"], "tracking": "Gantt Chart"},
        {"id": 12, "domain": "Manufacturing", "department": "logistics", "name": "Raw Material Ordering", "steps": ["Request","Approve","Order","Receive"], "kpi": ["Stock Level"]},
        {"id": 13, "domain": "Manufacturing", "department": "finance", "name": "Cost Analysis", "steps": ["Collect Data","Analyze","Report"], "kpi": ["Cost Efficiency"]},
        {"id": 17, "domain": "Manufacturing", "department": "hr", "name": "Worker Evaluation", "steps": ["Data","Evaluate","Approve"], "kpi": ["Performance Score"]},
        {"id": 20, "domain": "Manufacturing", "department": "marketing", "name": "Product Launch", "steps": ["Plan","Approve","Launch"], "kpi": ["Sales"]}
    ]

    for p in processes:
        if p['domain'].lower() != domain.lower():
            continue
        
        cur.execute("""
            INSERT INTO workflow_definitions (name, domain, department, trigger_desc, steps_json, kpi_json, tracking_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (p['name'], p['domain'], p['department'], p.get('trigger', ''), json.dumps(p['steps']), json.dumps(p.get('kpi', [])), p.get('tracking', 'Standard Timeline')))
    
    conn.commit()


def _seed_tasks(conn, domain):
    """Seed the 40 specialized enterprise tasks."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM tasks")
    if cur.fetchone()[0] > 0:
        return
        
    # Full 40 tasks from user request
    tasks_data = [
        # Banking (10)
        {"domain": "Banking", "task": "Review Loan Application", "from": "operator", "to": "finance", "approval": "manager", "priority": "High"},
        {"domain": "Banking", "task": "Verify Customer Documents", "from": "operator", "to": "hr", "approval": "manager", "priority": "Medium"},
        {"domain": "Banking", "task": "Prepare Financial Risk Report", "from": "finance", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Banking", "task": "Launch Credit Campaign", "from": "marketing", "to": "finance", "approval": "manager", "priority": "Medium"},
        {"domain": "Banking", "task": "Internal Audit Request", "from": "manager", "to": "finance", "approval": "director", "priority": "High"},
        {"domain": "Banking", "task": "Customer Complaint Analysis", "from": "operator", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Banking", "task": "Fraud Case Investigation", "from": "finance", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Banking", "task": "Update Customer Database", "from": "operator", "to": "pm", "approval": "manager", "priority": "Low"},
        {"domain": "Banking", "task": "Branch Performance Report", "from": "finance", "to": "director", "approval": "ceo", "priority": "High"},
        {"domain": "Banking", "task": "New Service Proposal", "from": "marketing", "to": "director", "approval": "ceo", "priority": "Medium"},

        # Healthcare (10)
        {"domain": "Healthcare", "task": "Approve Medical Supply Request", "from": "logistics", "to": "finance", "approval": "manager", "priority": "High"},
        {"domain": "Healthcare", "task": "Schedule Staff Shifts", "from": "hr", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Healthcare", "task": "Analyze Patient Cost Data", "from": "finance", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Healthcare", "task": "Plan Awareness Campaign", "from": "marketing", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Healthcare", "task": "Inventory Check", "from": "logistics", "to": "operator", "approval": "manager", "priority": "Low"},
        {"domain": "Healthcare", "task": "Doctor Performance Evaluation", "from": "hr", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Healthcare", "task": "Emergency Resource Allocation", "from": "pm", "to": "logistics", "approval": "manager", "priority": "High"},
        {"domain": "Healthcare", "task": "Patient Data Audit", "from": "finance", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Healthcare", "task": "Medical Equipment Purchase", "from": "logistics", "to": "finance", "approval": "director", "priority": "High"},
        {"domain": "Healthcare", "task": "Hospital Expansion Plan", "from": "pm", "to": "director", "approval": "ceo", "priority": "High"},

        # Education (10)
        {"domain": "Education", "task": "Review At-Risk Students", "from": "analytics", "to": "academics", "approval": "manager", "priority": "High"},
        {"domain": "Education", "task": "Assign Tutoring Schedules", "from": "academics", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Education", "task": "Prepare Course Budget", "from": "finance", "to": "pm", "approval": "manager", "priority": "Medium"},
        {"domain": "Education", "task": "Evaluate Teacher Quality", "from": "academics", "to": "hr", "approval": "manager", "priority": "High"},
        {"domain": "Education", "task": "Distribute Learning Materials", "from": "logistics", "to": "operator", "approval": "manager", "priority": "Low"},
        {"domain": "Education", "task": "Student Performance Report", "from": "academics", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Education", "task": "Review Extracurricular Requests", "from": "academics", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Education", "task": "Course Drop Process", "from": "academics", "to": "finance", "approval": "manager", "priority": "Medium"},
        {"domain": "Education", "task": "Scholarship Approval", "from": "finance", "to": "director", "approval": "ceo", "priority": "Medium"},
        {"domain": "Education", "task": "New Program Launch", "from": "marketing", "to": "director", "approval": "ceo", "priority": "High"},

        # Manufacturing (10)
        {"domain": "Manufacturing", "task": "Approve Production Plan", "from": "pm", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Manufacturing", "task": "Order Raw Materials", "from": "logistics", "to": "finance", "approval": "manager", "priority": "High"},
        {"domain": "Manufacturing", "task": "Analyze Production Cost", "from": "finance", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Manufacturing", "task": "Worker Performance Review", "from": "hr", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Manufacturing", "task": "Launch Product Campaign", "from": "marketing", "to": "manager", "approval": "director", "priority": "Medium"},
        {"domain": "Manufacturing", "task": "Machine Maintenance Scheduling", "from": "logistics", "to": "pm", "approval": "manager", "priority": "High"},
        {"domain": "Manufacturing", "task": "Quality Control Check", "from": "operator", "to": "pm", "approval": "manager", "priority": "High"},
        {"domain": "Manufacturing", "task": "Supplier Evaluation", "from": "logistics", "to": "finance", "approval": "manager", "priority": "Medium"},
        {"domain": "Manufacturing", "task": "Production Delay Analysis", "from": "pm", "to": "manager", "approval": "director", "priority": "High"},
        {"domain": "Manufacturing", "task": "Factory Expansion Plan", "from": "pm", "to": "director", "approval": "ceo", "priority": "High"}
    ]

    for t in tasks_data:
        if t['domain'].lower() != domain.lower():
            continue
            
        cur.execute("""
            INSERT INTO tasks (title, domain, from_dept, to_dept, approval_role, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (t['task'], t['domain'], t['from'], t['to'], t['approval'], t['priority']))
        
    conn.commit()


def _seed_users(conn, domain):
    cur = conn.cursor()
    # Seed built-in roles
    cur.execute("SELECT COUNT(*) FROM roles")
    if cur.fetchone()[0] == 0:
        roles_data = [
            ('Domain Admin', 4, '#e53935', 1, '{"Dashboard":["view"],"Data":["view","add","edit","delete"],"Analytics":["view","export"],"Campaigns":["create","manage","approve"],"AI Assistant":["use","restricted"],"Automation":["create","run","stop"],"Audit Logs":["view"]}'),
            ('Manager', 3, '#1e88e5', 1, '{"Dashboard":["view"],"Data":["view","add","edit"],"Analytics":["view","export"],"Campaigns":["create","manage"],"AI Assistant":["use"],"Automation":["run","stop"],"Audit Logs":[]}'),
            ('Employee', 2, '#43a047', 1, '{"Dashboard":["view"],"Data":["view","add"],"Analytics":["view"],"Campaigns":[],"AI Assistant":["use"],"Automation":["run"],"Audit Logs":[]}'),
            ('Viewer', 1, '#757575', 1, '{"Dashboard":["view"],"Data":["view"],"Analytics":["view"],"Campaigns":[],"AI Assistant":[],"Automation":[],"Audit Logs":[]}')
        ]
        for r_name, r_level, r_color, r_builtin, r_perms in roles_data:
            cur.execute("INSERT OR IGNORE INTO roles (name, level, color, built_in) VALUES (?, ?, ?, ?)", (r_name, r_level, r_color, r_builtin))
            role_id = cur.lastrowid
            perms_dict = json.loads(r_perms)
            for mod, actions in perms_dict.items():
                cur.execute("INSERT INTO role_permissions (role_id, module, actions_json) VALUES (?, ?, ?)", (role_id, mod, json.dumps(actions)))
    
    cur.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] > 0:
        return
        
    role_map = {'admin': 1, 'manager': 2, 'analyst': 3, 'operator': 3}
    for u in DEFAULT_USERS:
        old_role = u.get('role', 'operator')
        rid = role_map.get(old_role, 3)
        cur.execute("""
            INSERT OR IGNORE INTO users (username, password_hash, role_id, name, email, department, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        """, (u['username'], hash_password(u['password']), rid, u['name'], u.get('email', f"{u['username']}@aura.io"), u.get('department')))
    conn.commit()


def _rand_date(days_ago_max=365, days_ago_min=0):
    d = datetime.now() - timedelta(days=random.randint(days_ago_min, days_ago_max))
    return d.strftime('%Y-%m-%d')


def _seed_sample_data(conn, domain):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM employees")
    if cur.fetchone()[0] > 0:
        return  # already seeded

    # 1. Seed Core Employees from Config
    core_staff = CORE_EMPLOYEE_DATA.get(domain, {})
    pwd_hash = hash_password('pass123')
    for dept_id, staff_list in core_staff.items():
        for emp in staff_list:
            emp_email = f"{emp['name'].lower().replace(' ', '.')}@aura.com"
            # Insert into employees table
            cur.execute("""
                INSERT OR IGNORE INTO employees (employee_id, name, department, position, email, status, hire_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"EMP-{emp['id']:04d}", 
                emp['name'], 
                dept_id, 
                emp['role'], 
                emp_email,
                'active',
                _rand_date(500, 30)
            ))
            # ALSO Insert into users table to enable login
            cur.execute("""
                INSERT OR IGNORE INTO users (username, password_hash, role_id, name, email, department, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            """, (
                emp_email,
                pwd_hash,
                2, # Manager role ID (level 3)
                emp['name'],
                emp_email,
                dept_id
            ))
    conn.commit()

    # 2. Add some random employees for variety if needed
    cur.execute("SELECT COUNT(*) FROM employees")
    if cur.fetchone()[0] > 20:
        return # Skip if we already have plenty

    depts = list(DEPARTMENTS.keys())
    positions_map = {
        'banking':       ['Loan Officer', 'Teller', 'Compliance Officer', 'Risk Analyst', 'Branch Manager', 'Investment Advisor'],
        'healthcare':    ['Doctor', 'Nurse', 'Pharmacist', 'Radiologist', 'Surgeon', 'Lab Technician'],
        'education':     ['Teacher', 'Professor', 'Dean', 'Counselor', 'Librarian', 'Registrar'],
        'manufacturing': ['Engineer', 'Technician', 'Quality Inspector', 'Supervisor', 'Planner', 'Maintenance Lead'],
    }
    positions = positions_map.get(domain, ['Staff', 'Lead', 'Manager', 'Director', 'Analyst', 'Coordinator'])
    names = ['James Wilson', 'Emma Davis', 'Oliver Brown', 'Sophia Johnson', 'Liam Martinez',
             'Isabella Garcia', 'Noah Anderson', 'Mia Taylor', 'Ethan Thomas', 'Ava Jackson',
             'Mason White', 'Charlotte Harris', 'Logan Martin', 'Amelia Lee', 'Lucas Clark',
             'Harper Lewis', 'Benjamin Robinson', 'Evelyn Walker', 'Henry Hall', 'Abigail Young']

    emp_ids = []
    for i, name in enumerate(names):
        dept = random.choice(depts)
        pos = random.choice(positions)
        sal = round(random.uniform(35000, 120000), 2)
        eid = f"EMP{1000+i:04d}"
        cur.execute("""INSERT INTO employees (employee_id,name,department,position,email,phone,salary,hire_date,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (eid, name, dept, pos,
             f"{name.lower().replace(' ','.')}@{domain}.aura",
             f"+1-555-{random.randint(1000,9999)}",
             sal, _rand_date(1460, 30), random.choice(['active','active','active','on-leave'])))
        emp_ids.append(cur.lastrowid)

    # Finance
    statuses = ['paid', 'pending', 'overdue', 'draft']
    clients = ['Acme Corp', 'GlobalTech', 'Vertex Ltd', 'Nexus Group', 'Summit Inc', 'Apex Partners']
    for i in range(25):
        amt = round(random.uniform(500, 50000), 2)
        tax = round(amt * 0.15, 2)
        cur.execute("""INSERT INTO invoices (invoice_number,client,amount,tax,total,status,due_date,department)
            VALUES (?,?,?,?,?,?,?,?)""",
            (f"INV-{2025}-{1000+i}", random.choice(clients), amt, tax, amt+tax,
             random.choice(statuses), _rand_date(90, -30), random.choice(depts)))

    for dept in depts:
        alloc = round(random.uniform(100000, 500000), 2)
        spent = round(alloc * random.uniform(0.2, 0.9), 2)
        cur.execute("""INSERT INTO budgets (department,period,allocated,spent,remaining,status)
            VALUES (?,?,?,?,?,?)""", (dept, '2025-Q1', alloc, spent, alloc-spent, 'active'))

    for _ in range(40):
        amt = round(random.uniform(100, 10000), 2)
        cur.execute("""INSERT INTO expenses (category,description,amount,department,status,date)
            VALUES (?,?,?,?,?,?)""",
            (random.choice(['Travel','Office','Software','Hardware','Training']),
             'Business expense', amt, random.choice(depts),
             random.choice(['approved','pending','rejected']), _rand_date(180)))

    for _ in range(60):
        amt = round(random.uniform(1000, 100000), 2) * random.choice([-1, 1])
        cur.execute("""INSERT INTO transactions (type,reference,description,amount,department,date)
            VALUES (?,?,?,?,?,?)""",
            (random.choice(['credit','debit']), f"REF-{random.randint(10000,99999)}",
             'Transaction', amt, random.choice(depts), _rand_date(365)))

    # Operations / Tasks
    priorities = ['low', 'medium', 'high', 'critical']
    task_statuses = ['todo', 'in-progress', 'review', 'done']
    task_titles = ['Review monthly report', 'Update system records', 'Client follow-up',
                   'Process payroll', 'Audit compliance', 'Generate performance report',
                   'Onboard new employee', 'Budget reconciliation', 'Team meeting prep',
                   'Data quality check', 'System backup', 'KPI review']
    for _ in range(30):
        # Adjusted to match the new schema (title, domain, from_dept, to_dept, approval_role, priority)
        cur.execute("""INSERT INTO tasks (title, domain, from_dept, to_dept, priority, status)
            VALUES (?,?,?,?,?,?)""",
            (random.choice(task_titles), domain.capitalize(), 
             random.choice(depts), random.choice(depts),
             random.choice(priorities).capitalize(), random.choice(task_statuses)))

    # KPIs
    kpi_defs = [
        ('Revenue Growth', 'finance', 15, '%'),
        ('Employee Satisfaction', 'hr', 85, 'score'),
        ('Customer Retention', 'crm', 90, '%'),
        ('Project Completion Rate', 'pm', 80, '%'),
        ('Operational Efficiency', 'operations', 75, '%'),
        ('Lead Conversion', 'sales', 25, '%'),
        ('Report Accuracy', 'analytics', 98, '%'),
    ]
    for name, dept, target, unit in kpi_defs:
        actual = round(target * random.uniform(0.7, 1.15), 1)
        cur.execute("""INSERT INTO kpis (name,department,target,actual,unit,period,status,trend)
            VALUES (?,?,?,?,?,?,?,?)""",
            (name, dept, target, actual, unit, '2025-Q1',
             'on-track' if actual >= target * 0.9 else 'at-risk',
             random.choice(['up','down','stable'])))

    # CRM
    cust_names = ['Sarah Connor', 'John Doe', 'Alice Smith', 'Bob Johnson', 'Carol White',
                  'David Brown', 'Eve Davis', 'Frank Wilson', 'Grace Lee', 'Henry Clark']
    cust_ids = []
    pwd_hash = hash_password('pass123')
    for cn in cust_names:
        cur.execute("""INSERT INTO customers (name,email,phone,password_hash,company,type,status,value)
            VALUES (?,?,?,?,?,?,?,?)""",
            (cn, f"{cn.lower().replace(' ','.')}@client.com",
             f"+1-555-{random.randint(1000,9999)}", pwd_hash,
             f"{cn.split()[-1]} Corp", random.choice(['individual','corporate']),
             random.choice(['active','active','inactive']),
             round(random.uniform(5000, 500000), 2)))
        cust_ids.append(cur.lastrowid)

    for i in range(15):
        if cust_ids:
            cur.execute("""INSERT INTO leads (name,email,source,status,score,estimated_value)
                VALUES (?,?,?,?,?,?)""",
                (f"Lead {i+1}", f"lead{i}@prospect.com",
                 random.choice(['website','referral','campaign','cold-call']),
                 random.choice(['new','contacted','qualified','lost']),
                 random.randint(10, 100),
                 round(random.uniform(1000, 50000), 2)))

    # Sales Deals
    stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']
    for i in range(20):
        cur.execute("""INSERT INTO deals (title,stage,value,probability,expected_close,status)
            VALUES (?,?,?,?,?,?)""",
            (f"Deal #{1000+i}", random.choice(stages),
             round(random.uniform(10000, 500000), 2),
             random.randint(10, 95), _rand_date(-10, -90), 'active'))

    for _ in range(8):
        budget = round(random.uniform(5000, 50000), 2)
        cur.execute("""INSERT INTO campaigns (name,type,budget,spent,start_date,end_date,status,leads_generated)
            VALUES (?,?,?,?,?,?,?,?)""",
            (f"Campaign Q{random.randint(1,4)}", random.choice(['email','social','ppc','event']),
             budget, round(budget*random.uniform(0.3,0.9),2),
             _rand_date(180, 90), _rand_date(30, 0),
             random.choice(['active','completed','draft']),
             random.randint(5, 200)))

    # Projects
    proj_statuses = ['planning', 'active', 'on-hold', 'completed']
    proj_ids = []
    for i in range(12):
        budget = round(random.uniform(50000, 500000), 2)
        spent = round(budget * random.uniform(0.1, 0.8), 2)
        comp = random.randint(0, 100)
        cur.execute("""INSERT INTO projects (name,description,department,budget,spent,start_date,end_date,status,completion,priority)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (f"Project Alpha {chr(65+i)}", f"Strategic initiative {i+1}",
             random.choice(depts), budget, spent,
             _rand_date(365, 180), _rand_date(-30, -180),
             random.choice(proj_statuses), comp, random.choice(['low','medium','high'])))
        proj_ids.append(cur.lastrowid)

    # Milestones
    for pid in proj_ids:
        for j in range(random.randint(2, 5)):
            cur.execute("""INSERT INTO milestones (project_id,name,due_date,status,completion)
                VALUES (?,?,?,?,?)""",
                (pid, f"Milestone {j+1}",
                 _rand_date(-10, -120),
                 random.choice(['pending','in-progress','completed']),
                 random.randint(0, 100)))

    # Metrics (time series for charts)
    for dept in depts:
        for i in range(12):
            month = (datetime.now() - timedelta(days=30*i)).strftime('%Y-%m')
            cur.execute("""INSERT INTO metrics (name,department,value,unit,period,date)
                VALUES (?,?,?,?,?,?)""",
                ('performance_score', dept, round(random.uniform(60, 95), 1), 'score', month,
                 (datetime.now() - timedelta(days=30*i)).strftime('%Y-%m-%d')))
            cur.execute("""INSERT INTO metrics (name,department,value,unit,period,date)
                VALUES (?,?,?,?,?,?)""",
                ('revenue', dept, round(random.uniform(50000, 500000), 2), 'USD', month,
                 (datetime.now() - timedelta(days=30*i)).strftime('%Y-%m-%d')))

    # Decisions history
    decision_examples = [
        ('Expand remote work policy', 'hr',
         json.dumps(['Full remote', 'Hybrid 3-day', 'Office mandatory']),
         'Hybrid 3-day', 'positive', 0.82),
        ('Increase marketing budget', 'finance',
         json.dumps(['10% increase', '25% increase', 'Keep same']),
         '25% increase', 'negative', 0.45),
        ('Adopt new CRM platform', 'crm',
         json.dumps(['Salesforce', 'HubSpot', 'Build custom']),
         'HubSpot', 'positive', 0.78),
        ('Launch loyalty program', 'sales',
         json.dumps(['Points system', 'Tiered rewards', 'Cashback']),
         'Tiered rewards', 'positive', 0.88),
    ]
    for title, dept, opts, chosen, outcome, score in decision_examples:
        cur.execute("""INSERT INTO decisions (domain,department,title,options,chosen_option,outcome,success_score)
            VALUES (?,?,?,?,?,?,?)""",
            (domain, dept, title, opts, chosen, outcome, score))

    conn.commit()


def init_all_domains():
    for domain in DOMAINS:
        init_domain_db(domain)


# ─── CRUD Helpers ─────────────────────────────────────────────────────────────

def get_records(domain, table, filters=None, limit=200, offset=0, search=None):
    conn = get_conn(domain)
    try:
        query = f"SELECT * FROM {table}"
        params = []
        where = []
        if filters:
            for k, v in filters.items():
                where.append(f"{k} = ?")
                params.append(v)
        if search:
            # search across all text fields
            cur = conn.cursor()
            cur.execute(f"PRAGMA table_info({table})")
            cols = [r['name'] for r in cur.fetchall() if r['type'] in ('TEXT', '')]
            if cols:
                where.append("(" + " OR ".join(f"{c} LIKE ?" for c in cols) + ")")
                params.extend([f"%{search}%" for _ in cols])
        if where:
            query += " WHERE " + " AND ".join(where)
        query += f" ORDER BY id DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        cur = conn.cursor()
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        # count
        count_q = f"SELECT COUNT(*) FROM {table}"
        if where:
            count_q += " WHERE " + " AND ".join(where[:-1] if search else where)
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        total = cur.fetchone()[0]
        return rows, total
    finally:
        conn.close()


def get_record(domain, table, record_id):
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {table} WHERE id = ?", (record_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_record(domain, table, data):
    conn = get_conn(domain)
    try:
        data.pop('id', None)
        data['created_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if 'updated_at' in _get_columns(conn, table):
            data['updated_at'] = data['created_at']
        cols = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        cur = conn.cursor()
        cur.execute(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", list(data.values()))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_record(domain, table, record_id, data):
    conn = get_conn(domain)
    try:
        data.pop('id', None)
        if 'updated_at' in _get_columns(conn, table):
            data['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        sets = ', '.join(f"{k} = ?" for k in data)
        cur = conn.cursor()
        cur.execute(f"UPDATE {table} SET {sets} WHERE id = ?", list(data.values()) + [record_id])
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def delete_record(domain, table, record_id):
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def _get_columns(conn, table):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [r['name'] for r in cur.fetchall()]


def get_table_schema(domain, table):
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute(f"PRAGMA table_info({table})")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_all_tables(domain):
    conn = get_conn(domain)
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def bulk_insert_csv(domain, table, rows):
    """rows is a list of dicts from CSV."""
    conn = get_conn(domain)
    try:
        columns = _get_columns(conn, table)
        ids = []
        for row in rows:
            clean = {k: v for k, v in row.items() if k in columns and k != 'id'}
            if not clean:
                continue
            cols = ', '.join(clean.keys())
            ph = ', '.join(['?' for _ in clean])
            cur = conn.cursor()
            cur.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", list(clean.values()))
            ids.append(cur.lastrowid)
        conn.commit()
        return ids
    finally:
        conn.close()
