"""
seed_all_domains.py
Generates massive, realistic mock data for Banking, Education, Healthcare, and Manufacturing domains.
Run from the /aura directory: python scripts/seed_all_domains.py
"""
import sys, os, json, random, sqlite3
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.db_manager import get_conn, ensure_banking_schema, ensure_education_schema, ensure_healthcare_schema, ensure_manufacturing_schema

# ─── Helpers ────────────────────────────────────────────────────────────────
def rand_date(start_days_ago=730, end_days_ago=0):
    lo = min(start_days_ago, end_days_ago)
    hi = max(start_days_ago, end_days_ago)
    d = datetime.now() - timedelta(days=random.randint(lo, hi))
    return d.strftime('%Y-%m-%d')

def rand_ts(start_days_ago=365, end_days_ago=0):
    lo = min(start_days_ago, end_days_ago)
    hi = max(start_days_ago, end_days_ago)
    d = datetime.now() - timedelta(days=random.randint(lo, hi),
                                   hours=random.randint(0, 23), minutes=random.randint(0, 59))
    return d.isoformat()

def rand_float(lo, hi, decimals=2):
    return round(random.uniform(lo, hi), decimals)

def rand_int(lo, hi):
    return random.randint(lo, hi)

FIRST = ['Ahmed','Sara','Mohammed','Fatima','Omar','Layla','Khalid','Aisha',
         'Yousef','Mariam','Ali','Noor','Hassan','Reem','Tariq','Dana',
         'Jassim','Hessa','Saad','Maryam','David','Sarah','Michael','Emily',
         'James','Jessica','Robert','Ashley','John','Jennifer','Carlos','Maria']
LAST  = ['Al-Rashid','Hassan','Al-Khalifa','Ibrahim','Al-Mansouri','Qasim',
         'Al-Farsi','Nasser','Al-Sayed','Yusuf','Al-Hamad','Jaber','Al-Thani',
         'Smith','Johnson','Williams','Brown','Jones','Garcia','Martinez',
         'Anderson','Taylor','Thomas','Jackson','White','Harris','Lee']

def rand_name():
    return "%s %s" % (random.choice(FIRST), random.choice(LAST))

BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
ICD10 = ['J06.9','I10','E11.9','M54.5','K21.0','J45.909','G43.909','F41.1',
         'Z00.00','R05','N39.0','L30.9','H10.9','S72.001A','T14.90']
CHRONIC = ['Hypertension','Type 2 Diabetes','Asthma','Arthritis','Hypothyroidism',
           'GERD','Chronic Back Pain','Depression','Anxiety Disorder','None']
ALLERGY = ['Penicillin','Sulfa drugs','NSAIDs','Latex','Peanuts',
           'Tree nuts','Shellfish','Aspirin','None']
VISIT_TYPE = ['Outpatient','Emergency','Follow-up','Routine Checkup','Specialist Referral','Telemedicine']
SURGERY_TYPE = ['Cardiac Bypass','Appendectomy','Hip Replacement','Cataract Removal',
                'Laparoscopic Cholecystectomy','Spinal Fusion','Knee Arthroscopy','Organ Transplant']

# ─── Banking ─────────────────────────────────────────────────────────────────
def seed_banking(conn):
    print("  Seeding Banking domain...")
    ensure_banking_schema(conn)
    cur = conn.cursor()

    # Bank_Accounts -- actual columns: acc_id, user_id, branch_id, account_no, iban_code,
    # swift_bic, account_type, account_tier, currency_id, balance_ledger, balance_available,
    # unrealized_gains_losses, interest_rate_apy, overdraft_limit, daily_transfer_limit,
    # kyc_status, is_multisig, account_status, opening_date, last_activity_at
    account_types = ['savings','checking','fixed_deposit','business_current','investment']
    tiers = ['standard','silver','gold','platinum']
    currencies = ['USD','EUR','AED','SAR','GBP']
    statuses = ['active','active','active','active','dormant','suspended']
    acc_ids = []
    for i in range(1, 61):
        bal = rand_float(500, 250000)
        cur.execute("""
            INSERT INTO Bank_Accounts
            (user_id, branch_id, account_no, iban_code, swift_bic,
             account_type, account_tier, currency_id, balance_ledger, balance_available,
             unrealized_gains_losses, interest_rate_apy, overdraft_limit, daily_transfer_limit,
             kyc_status, is_multisig, account_status, opening_date, last_activity_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (rand_int(1,50), rand_int(1,10), "AURA-%08d" % rand_int(10000000,99999999),
              "AE%022d" % rand_int(0, 10**22-1),
              random.choice(['AURAAEAD','AEDHAEAD','BFCAAEAD']),
              random.choice(account_types), random.choice(tiers),
              random.choice(currencies), bal, bal * rand_float(0.85, 1.0),
              rand_float(-500, 5000), rand_float(0.5, 8.5),
              rand_float(0, 5000), rand_float(5000, 50000),
              random.choice(['verified','pending','rejected']),
              0, random.choice(statuses),
              rand_date(1825, 1), rand_ts(90, 0)))
        acc_ids.append(cur.lastrowid)

    # Bank_Loans_Advanced -- actual columns: loan_id, user_id, loan_product_type,
    # principal_amount, interest_rate_fixed_variable, amortization_period_months,
    # next_payment_date, total_paid_to_date, remaining_balance, late_fee_percentage,
    # credit_score_on_approval, loan_status
    loan_types = ['Personal','Mortgage','Auto','Business','Education','Emergency']
    loan_statuses = ['pending','under_review','approved','rejected','disbursed','closed']
    loan_ids = []
    for i in range(1, 101):
        amount = rand_float(5000, 500000)
        paid = rand_float(0, amount * 0.6)
        cur.execute("""
            INSERT INTO Bank_Loans_Advanced
            (user_id, loan_product_type, principal_amount, interest_rate_fixed_variable,
             amortization_period_months, next_payment_date, total_paid_to_date,
             remaining_balance, late_fee_percentage, credit_score_on_approval, loan_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (rand_int(1,50), random.choice(loan_types), amount,
              rand_float(3.5, 18.0),
              random.choice([12,24,36,48,60,84,120]),
              rand_date(0, 60),
              paid, amount - paid,
              rand_float(0.5, 5.0), rand_int(450, 850),
              random.choice(loan_statuses)))
        loan_ids.append(cur.lastrowid)

    # Bank_Transactions_Detail -- actual columns: trans_id, from_account_id, to_account_id,
    # amount_original_curr, exchange_rate_applied, fee_json, trans_category, trans_status,
    # transaction_hash_ref, merchant_id, location_gps, ip_address, fraud_score,
    # description_text, created_at
    tx_cats = ['debit','credit','transfer','fee','interest','loan_disbursement','reversal']
    for i in range(1, 201):
        fa = random.choice(acc_ids) if acc_ids else 1
        ta = random.choice(acc_ids) if acc_ids else 1
        cur.execute("""
            INSERT INTO Bank_Transactions_Detail
            (from_account_id, to_account_id, amount_original_curr, exchange_rate_applied,
             fee_json, trans_category, trans_status, transaction_hash_ref,
             merchant_id, location_gps, ip_address, fraud_score, description_text, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (fa, ta, rand_float(50, 50000), rand_float(0.95, 1.05),
              json.dumps({"processing_fee": rand_float(0, 25), "tax": rand_float(0, 5)}),
              random.choice(tx_cats), random.choice(['completed','completed','completed','pending','failed']),
              "TXN%012d" % rand_int(10**11, 10**12-1),
              rand_int(1,200),
              "%.4f,%.4f" % (rand_float(24.0, 26.0), rand_float(54.0, 56.0)),
              "192.168.%d.%d" % (rand_int(1,254), rand_int(1,254)),
              rand_float(0.0, 100.0),
              random.choice(['Online Purchase','ATM Withdrawal','Bank Transfer',
                             'Salary Credit','Utility Payment','Loan Installment']),
              rand_ts(365, 0)))

    # Bank_Credit_Cards_Master -- actual columns: card_id, account_id, card_brand,
    # card_number_masked, expiry_date, cvv_encrypted, credit_limit_assigned,
    # current_outstanding_balance, reward_points_balance, is_contactless_enabled, card_status
    for i in range(1, 31):
        limit = rand_float(5000, 100000)
        cur.execute("""
            INSERT INTO Bank_Credit_Cards_Master
            (account_id, card_brand, card_number_masked, expiry_date, cvv_encrypted,
             credit_limit_assigned, current_outstanding_balance,
             reward_points_balance, is_contactless_enabled, card_status)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (random.choice(acc_ids) if acc_ids else rand_int(1,60),
              random.choice(['Visa Platinum','Mastercard Gold','Amex Black','Visa Classic']),
              "****-****-****-%04d" % rand_int(1000,9999),
              "%02d/%02d" % (rand_int(1,12), rand_int(26,30)),
              "ENC-%d" % rand_int(100000,999999),
              limit, rand_float(0, limit * 0.8),
              rand_int(0, 50000), 1,
              random.choice(['active','active','blocked','expired'])))

    # Bank_Collaterals_Vault -- loan_id, asset_class, asset_valuation_market,
    # last_appraisal_date, appraisal_agency_name, legal_ownership_doc_url, insurance_coverage_ref
    asset_classes = ['Real Estate','Vehicle','Gold Bullion','Securities Portfolio','Commercial Property','Machinery']
    for i in range(1, 41):
        cur.execute("""
            INSERT INTO Bank_Collaterals_Vault
            (loan_id, asset_class, asset_valuation_market, last_appraisal_date,
             appraisal_agency_name, legal_ownership_doc_url, insurance_coverage_ref)
            VALUES (?,?,?,?,?,?,?)
        """, (random.choice(loan_ids) if loan_ids else i,
              random.choice(asset_classes), rand_float(50000, 2000000),
              rand_date(180, 1),
              random.choice(['Al-Eqar Valuations','Gulf Appraisers','National Assessment Co.']),
              "https://docs.aura.com/collateral/%d.pdf" % rand_int(10000,99999),
              "INS-%d" % rand_int(100000,999999)))

    conn.commit()
    print("  [OK] Banking: 60 accounts, 100 loans, 200 transactions, 30 cards, 40 collaterals")

# ─── Education ───────────────────────────────────────────────────────────────
def seed_education(conn):
    print("  Seeding Education domain...")
    ensure_education_schema(conn)
    cur = conn.cursor()

    semesters = ['FALL2024','SPRING2025','FALL2025','SPRING2026']

    # Edu_Curriculum_Detailed
    titles_en = ['Data Structures','Algorithm Design','Database Systems','Machine Learning','Computer Networks',
                 'Financial Accounting','Marketing Principles','Business Ethics','Corporate Finance','Operations Management',
                 'Anatomy I','Clinical Pharmacology','Medical Ethics','Pathology II','Internal Medicine',
                 'Thermodynamics','Structural Analysis','Circuit Theory','Fluid Mechanics','Materials Science',
                 'Contract Law','Criminal Procedure','Constitutional Law','International Law','Legal Writing',
                 'Calculus II','Linear Algebra','Statistical Methods','Research Methodology','Capstone Project']
    courses = []
    for i, title in enumerate(titles_en):
        cur.execute("""
            INSERT INTO Edu_Curriculum_Detailed
            (course_code, title_en, title_ar, department_id, credit_hours,
             learning_outcomes_json, is_lab_required, prerequisites_json, syllabus_pdf_url)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, ("CRS%d" % (200+i), title, "مادة: %s" % title, rand_int(1,5),
              random.choice([2,3,4]),
              json.dumps(["Understand %s" % title, "Apply concepts", "Critical thinking"]),
              1 if random.random() > 0.6 else 0,
              json.dumps(["CRS%d" % rand_int(100,199)] if random.random() > 0.5 else []),
              "https://edu.aura.com/syllabus/crs%d.pdf" % (200+i)))
        courses.append(cur.lastrowid)

    # Edu_Students_Elite
    grad_statuses = ['enrolled','enrolled','enrolled','enrolled','graduated','probation','withdrawn']
    students = []
    for i in range(1, 101):
        gpa = rand_float(1.5, 4.0)
        cur.execute("""
            INSERT INTO Edu_Students_Elite
            (user_id, major_id, advisor_id, academic_year_level, cumulative_gpa,
             rank_in_cohort, total_credits_earned, probation_history_json,
             scholarship_amount_annual, extracurricular_points, graduation_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (rand_int(1,50), rand_int(1,5), rand_int(1,10), rand_int(1,4), gpa,
              rand_int(1,100), rand_int(0,130),
              json.dumps([{"semester":"FALL2024","reason":"GPA below 2.0"}] if gpa < 2.0 else []),
              rand_float(0, 15000) if gpa > 3.2 else 0.0,
              rand_int(0, 50), random.choice(grad_statuses)))
        students.append(cur.lastrowid)

    # Edu_Sections_Management
    sections = []
    for i in range(1, 51):
        cap = rand_int(20, 60)
        enrolled = rand_int(5, cap)
        cur.execute("""
            INSERT INTO Edu_Sections_Management
            (course_id, instructor_id, semester_code, capacity_max, current_enrolled_count,
             room_id, schedule_slots_json, attendance_tracking_method)
            VALUES (?,?,?,?,?,?,?,?)
        """, (random.choice(courses) if courses else rand_int(1,30),
              rand_int(1,15), random.choice(semesters), cap, enrolled,
              rand_int(100, 250),
              json.dumps([{"day": random.choice(["Mon","Tue","Wed","Thu"]), "time": "%d:00" % rand_int(8,17)}]),
              random.choice(['Biometric','QR Code','Manual','RFID'])))
        sections.append(cur.lastrowid)

    # Edu_Section_Enrollments
    enrolled_pairs = set()
    for _ in range(200):
        s_id = random.choice(students) if students else rand_int(1,100)
        sec_id = random.choice(sections) if sections else rand_int(1,50)
        if (s_id, sec_id) in enrolled_pairs:
            continue
        enrolled_pairs.add((s_id, sec_id))
        grade = random.choice(['A','A-','B+','B','B-','C+','C','D','F','IP'])
        cur.execute("""
            INSERT INTO Edu_Section_Enrollments
            (student_id, section_id, final_grade, total_score, attendance_rate)
            VALUES (?,?,?,?,?)
        """, (s_id, sec_id, grade, rand_float(40, 100), rand_float(55, 100)))

    # Edu_Exams_Proctored
    exam_types = ['Midterm','Final','Quiz','Lab Practical','Oral Defense']
    for i in range(1, 61):
        avg = rand_float(45, 90)
        cur.execute("""
            INSERT INTO Edu_Exams_Proctored
            (section_id, exam_type, total_weight_percentage, average_score,
             highest_score, proctoring_system_logs_url, exam_date)
            VALUES (?,?,?,?,?,?,?)
        """, (random.choice(sections) if sections else rand_int(1,50),
              random.choice(exam_types), random.choice([10,15,20,25,30,40]),
              avg, rand_float(avg, 100),
              "https://proctoring.aura.com/logs/exam%d.log" % rand_int(10000,99999),
              rand_ts(300, 1)))

    # Edu_Research_Grants_Portal
    agencies = ['National Research Foundation','Qatar Fund for Development','UAE Science Authority',
                'Saudi Aramco Research Grant','WHO Global Research Initiative','EU Horizon Fund']
    research_titles = ['AI-Driven Drug Discovery','Quantum Computing Applications','Renewable Energy Storage',
                       'Genomic Analysis of Desert Flora','Digital Literacy in MENA Region',
                       'Autonomous Vehicle Safety Protocols','Sustainable Architecture Methods',
                       'Cancer Biomarker Detection','Climate Change Impact Assessment',
                       'Blockchain in Healthcare Records','Smart Grid Optimization',
                       'Neural Interface Research','Nanoparticle Drug Delivery',
                       'Urban Water Desalination Study','Post-COVID Mental Health Analysis']
    for i in range(1, 21):
        cur.execute("""
            INSERT INTO Edu_Research_Grants_Portal
            (principal_investigator_id, title_of_research, funding_agency,
             total_budget_approved, ethics_committee_approval_no, publication_count, start_date)
            VALUES (?,?,?,?,?,?,?)
        """, (rand_int(1,15), random.choice(research_titles), random.choice(agencies),
              rand_float(50000, 2000000),
              "EC-%d" % rand_int(10000,99999), rand_int(0, 12),
              rand_date(730, 30)))

    conn.commit()
    print("  [OK] Education: 30 courses, 100 students, 50 sections, 200 enrollments, 60 exams, 20 grants")

# ─── Healthcare ──────────────────────────────────────────────────────────────
def seed_healthcare(conn):
    print("  Seeding Healthcare domain...")
    ensure_healthcare_schema(conn)
    cur = conn.cursor()

    # Health_Patient_Master
    patient_ids = []
    for i in range(1, 81):
        chronic = random.sample(CHRONIC, rand_int(0,2))
        allergies = random.sample(ALLERGY, rand_int(0,2))
        cur.execute("""
            INSERT INTO Health_Patient_Master
            (user_id, blood_group_rh, genomic_summary_hash, organ_donor_status,
             emergency_contact_json, chronic_diseases_list, allergy_profiles_json,
             vaccination_history_json, current_medication_list, primary_physician_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (rand_int(1,50), random.choice(BLOOD),
              "GEN-%d-%d" % (rand_int(100000,999999), rand_int(100,999)),
              1 if random.random() > 0.5 else 0,
              json.dumps({"name": rand_name(), "phone": "+971-5%d" % rand_int(10000000,99999999), "relation": "Spouse"}),
              ', '.join(chronic) if chronic else 'None',
              json.dumps(allergies if allergies else ['None']),
              json.dumps([{"vaccine": v, "date": rand_date(1800, 30)} for v in
                          random.sample(['COVID-19','Flu','Hepatitis B','MMR','Tetanus'], rand_int(1,4))]),
              ', '.join(["Med%d %dmg" % (rand_int(100,999), rand_int(5,50)) for _ in range(rand_int(0,3))]) or 'None',
              rand_int(1,15)))
        patient_ids.append(cur.lastrowid)

    symptoms_list = [
        'Patient reports persistent headache and fatigue.',
        'Presenting with chest discomfort and shortness of breath.',
        'Routine follow-up, condition stable, medication adjusted.',
        'Acute abdominal pain, elevated WBC count, further tests ordered.',
        'Symptoms of upper respiratory infection, mild fever noted.',
        'Patient complains of joint pain and morning stiffness.',
        'Follow-up for hypertension management. BP controlled.',
        'Presenting with skin rash and pruritus. Allergy suspected.'
    ]
    tx_plans = [
        'Rest and hydration advised. Follow-up in 2 weeks.',
        'Started on Metformin 500mg BD. Dietary changes recommended.',
        'Referred to cardiology. Pending ECG results.',
        'Prescribed antibiotics 7-day course. Monitor for improvement.',
        'Continue current medication. Schedule MRI in 4 weeks.',
        'Physiotherapy 3x weekly for 6 weeks. Pain management initiated.'
    ]

    # Health_EHR_Records
    for i in range(1, 121):
        p_id = random.choice(patient_ids) if patient_ids else rand_int(1,80)
        cur.execute("""
            INSERT INTO Health_EHR_Records
            (patient_id, doctor_id, visit_type, diagnosis_icd10_code, symptoms_narrative,
             vitals_json, treatment_plan_text, follow_up_date, digital_signature_doctor, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (p_id, rand_int(1,15), random.choice(VISIT_TYPE),
              random.choice(ICD10), random.choice(symptoms_list),
              json.dumps({"bp": "%d/%d" % (rand_int(100,145), rand_int(60,95)),
                          "pulse": rand_int(60,100), "temp_c": rand_float(36.0, 38.5),
                          "spo2": rand_float(94.0, 100.0), "weight_kg": rand_float(50, 120)}),
              random.choice(tx_plans),
              rand_date(7, 60),
              "DR-SIG-%d" % rand_int(10000,99999), rand_ts(500, 0)))

    # Health_Surgeries_Intensive
    post_op_notes = ['No complications observed.',
                     'Minor post-op bleeding, controlled and resolved.',
                     'Elevated heart rate post-procedure, cardiac monitoring continued.',
                     'Patient recovering well, discharged within 48 hours.',
                     'Wound healing as expected. Antibiotics prescribed.']
    for i in range(1, 26):
        p_id = random.choice(patient_ids) if patient_ids else rand_int(1,80)
        start = datetime.now() - timedelta(days=rand_int(1,400), hours=rand_int(7,12))
        end = start + timedelta(hours=rand_float(1.0, 8.0))
        cur.execute("""
            INSERT INTO Health_Surgeries_Intensive
            (patient_id, lead_surgeon_id, anesthesiologist_id, surgery_type_category,
             theater_id, robotic_assistance_used, blood_units_reserved, pre_op_clearance_status,
             post_op_complication_notes, surgery_start_time, surgery_end_time)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (p_id, rand_int(1,8), rand_int(1,5), random.choice(SURGERY_TYPE),
              rand_int(1,6), 1 if random.random() > 0.6 else 0,
              rand_int(0, 8), 1, random.choice(post_op_notes),
              start.isoformat(), end.isoformat()))

    # Health_Medical_Insurance_Claims
    claim_statuses = ['pending','approved','rejected','under_review','partially_approved']
    for i in range(1, 41):
        p_id = random.choice(patient_ids) if patient_ids else rand_int(1,80)
        requested = rand_float(500, 50000)
        status = random.choice(claim_statuses)
        approved = rand_float(requested * 0.5, requested) if status in ['approved','partially_approved'] else 0.0
        cur.execute("""
            INSERT INTO Health_Medical_Insurance_Claims
            (patient_id, insurance_provider_id, policy_number, claim_amount_requested,
             approved_amount, deductible_paid_by_patient, denial_reason_code, claim_status)
            VALUES (?,?,?,?,?,?,?,?)
        """, (p_id, rand_int(1,5), "POL-%d" % rand_int(100000,999999),
              requested, approved, rand_float(50, 500),
              random.choice(['PRE-AUTH-MISSING','OUT-OF-NETWORK','COVERAGE-LIMIT','']) if status == 'rejected' else '',
              status))

    # Health_Lab_Radiology
    test_cats = ['Blood Panel','MRI Brain','CT Chest','X-Ray','Urine Analysis',
                 'Echocardiogram','Liver Function Test','HbA1C','COVID PCR','Thyroid Profile']
    findings_list = ['Within normal range.',
                     'Mild cardiomegaly detected. Clinical correlation advised.',
                     'CRITICAL: Acute pulmonary embolism suspected. Immediate review required.',
                     'No evidence of malignancy.',
                     'Consolidation in right lower lobe. Pneumonia suspected.',
                     'Elevated troponin levels. Recommend cardiology consultation.',
                     'HbA1c at 9.2% indicating poor glycaemic control.']
    for i in range(1, 61):
        p_id = random.choice(patient_ids) if patient_ids else rand_int(1,80)
        is_critical = 1 if random.random() < 0.2 else 0
        cur.execute("""
            INSERT INTO Health_Lab_Radiology
            (patient_id, test_category, imaging_file_url, radiologist_findings,
             lab_values_json, is_critical_result)
            VALUES (?,?,?,?,?,?)
        """, (p_id, random.choice(test_cats),
              "https://pacs.aura.com/imaging/%d.dcm" % rand_int(100000,999999),
              random.choice(findings_list),
              json.dumps({"wbc": rand_float(3.5, 15.0), "rbc": rand_float(3.5, 6.0),
                          "hgb": rand_float(8.0, 18.0), "glucose_fasting": rand_float(70, 350),
                          "creatinine": rand_float(0.5, 3.0)}),
              is_critical))

    conn.commit()
    print("  [OK] Healthcare: 80 patients, 120 EHR records, 25 surgeries, 40 claims, 60 lab results")

# ─── Manufacturing ───────────────────────────────────────────────────────────
def seed_manufacturing(conn):
    print("  Seeding Manufacturing domain...")
    ensure_manufacturing_schema(conn)
    cur = conn.cursor()

    # Mfg_Products_Master
    product_names = ['Precision Valve Assembly','Lithium Cell Module','Control Circuit Board',
                     'Hydraulic Pump Unit','Optical Lens Array','Carbon Fiber Frame',
                     'Medical Grade Container','Titanium Fastener Set','LED Display Panel',
                     'Heat Exchange Unit','Polymer Bearing Kit','Smart Sensor Module',
                     'Industrial Servo Motor','Pneumatic Actuator','High-Torque Gearbox',
                     'Corrosion-Resistant Pipe Joint','Fiber Optic Switch','BLDC Motor Controller']
    product_ids = []
    for i in range(1, 41):
        name = random.choice(product_names)
        cur.execute("""
            INSERT INTO Mfg_Products_Master
            (sku_code, product_name, category_id, base_manufacturing_cost,
             retail_price_suggested, weight_kg, dimensions_json, is_customizable)
            VALUES (?,?,?,?,?,?,?,?)
        """, ("SKU-%d" % rand_int(10000,99999),
              "%s v%d.%d" % (name, rand_int(1,5), rand_int(0,9)),
              rand_int(1,6), rand_float(25, 5000), rand_float(50, 9500),
              rand_float(0.1, 250.0),
              json.dumps({"length_cm": rand_float(5, 200),
                          "width_cm": rand_float(5, 150),
                          "height_cm": rand_float(2, 100)}),
              1 if random.random() > 0.4 else 0))
        product_ids.append(cur.lastrowid)

    # Mfg_Production_Cycles
    cycle_statuses = ['planned','active','active','completed','completed','completed','halted']
    cycle_ids = []
    for i in range(1, 81):
        prod_id = random.choice(product_ids) if product_ids else rand_int(1,40)
        planned = rand_int(100, 5000)
        actual = rand_int(int(planned * 0.7), planned)
        waste = rand_int(0, max(1, int((planned - actual) * 0.3)))
        eff = round((actual / planned) * 100 - (waste / planned) * 10, 2)
        start = datetime.now() - timedelta(days=rand_int(1,365), hours=rand_int(6,10))
        end = start + timedelta(hours=rand_float(4, 48))
        status = random.choice(cycle_statuses)
        cur.execute("""
            INSERT INTO Mfg_Production_Cycles
            (product_id, production_line_id, planned_quantity, actual_produced_quantity,
             waste_quantity, start_timestamp, end_timestamp, cycle_efficiency_score, cycle_status)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (prod_id, rand_int(1,12), planned, actual, waste,
              start.isoformat(),
              end.isoformat() if status in ['completed','halted'] else None,
              max(0.0, eff), status))
        cycle_ids.append(cur.lastrowid)

    # Mfg_Supply_Chain_Global
    for i in range(1, 51):
        cur.execute("""
            INSERT INTO Mfg_Supply_Chain_Global
            (material_id, supplier_id, batch_tracking_number, carbon_footprint_kg,
             lead_time_days, shipment_gps_tracking_url, customs_duty_paid)
            VALUES (?,?,?,?,?,?,?)
        """, (rand_int(1,200), rand_int(1,30),
              "BATCH-%d" % rand_int(100000,999999),
              rand_float(0.5, 500.0), rand_int(2, 45),
              "https://gps.logistics.aura.com/track/%d" % rand_int(100000,999999),
              rand_float(0, 15000)))

    # Mfg_Quality_Assurance_AI
    qa_alert_count = 0
    for i in range(1, 61):
        cycle_id = random.choice(cycle_ids) if cycle_ids else rand_int(1,80)
        defects = rand_int(0, 25)
        outcome = 'pass' if defects < 3 else ('review' if defects < 8 else 'fail')
        if defects > 5:
            qa_alert_count += 1
        cur.execute("""
            INSERT INTO Mfg_Quality_Assurance_AI
            (cycle_id, ai_model_version, defect_detected_count, images_scan_url_json,
             inspection_outcome, inspector_human_override_id)
            VALUES (?,?,?,?,?,?)
        """, (cycle_id, "QA-Vision-v%d.%d" % (rand_int(2,4), rand_int(0,9)),
              defects,
              json.dumps(["https://qa.aura.com/scan/%d.jpg" % rand_int(100000,999999) for _ in range(rand_int(3,8))]),
              outcome,
              rand_int(1,10) if random.random() > 0.7 else None))

    # Mfg_IoT_Sensors_Network
    sensor_types = {
        'Temperature':  (60, 95, 120),
        'Pressure':     (40, 85, 120),
        'Vibration':    (1.0, 3.0, 5.0),
        'Humidity':     (25, 55, 85),
        'Torque':       (80, 160, 250),
        'RPM':          (800, 1600, 2500),
        'Voltage':      (190, 235, 260),
        'Flow Rate':    (3, 12, 30)
    }
    iot_alert_count = 0
    for i in range(1, 101):
        s_type = random.choice(list(sensor_types.keys()))
        lo_ok, hi_ok, limit = sensor_types[s_type]
        # 15% chance of exceeding threshold
        if random.random() < 0.15:
            reading = rand_float(limit, limit * 1.3)
        else:
            reading = rand_float(lo_ok, hi_ok)
        is_alert = 1 if reading > limit else 0
        if is_alert:
            iot_alert_count += 1
        cur.execute("""
            INSERT INTO Mfg_IoT_Sensors_Network
            (machine_id, sensor_type, real_time_reading, threshold_limit_max,
             last_maintenance_timestamp, iot_firmware_version, is_alert_triggered)
            VALUES (?,?,?,?,?,?,?)
        """, (rand_int(1,40), s_type, reading, limit,
              (datetime.now() - timedelta(days=rand_int(1,365))).isoformat(),
              "FW-%d.%d.%d" % (rand_int(2,4), rand_int(0,9), rand_int(0,99)),
              is_alert))

    conn.commit()
    print("  [OK] Manufacturing: 40 products, 80 cycles, 50 supply chains, 60 QA records (%d alerts), 100 IoT sensors (%d critical)" % (qa_alert_count, iot_alert_count))

# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n[*] Action Aura -- Full Domain Seed Starting...\n")
    domains = {
        'banking':       seed_banking,
        'education':     seed_education,
        'healthcare':    seed_healthcare,
        'manufacturing': seed_manufacturing
    }
    for domain, seed_fn in domains.items():
        print("[+] Domain: %s" % domain.upper())
        try:
            conn = get_conn(domain)
            conn.row_factory = sqlite3.Row
            seed_fn(conn)
            conn.close()
        except Exception as e:
            print("  [!] Error seeding %s: %s" % (domain, e))
            import traceback; traceback.print_exc()

    print("\n[OK] All domains seeded successfully!\n")
