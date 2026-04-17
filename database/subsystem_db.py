"""
Action Aura — Subsystem Database Manager
Manages three fully isolated SQLite databases:
  - Accounting System (accounting.db)
  - HR System (hr.db)
  - Inventory Management (inventory.db)
"""

import os
import sqlite3
from datetime import datetime, timedelta
import random

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUBSYS_DIR = os.path.join(BASE_DIR, 'subsystems')


def _get_path(name):
    os.makedirs(SUBSYS_DIR, exist_ok=True)
    return os.path.join(SUBSYS_DIR, f'{name}.db')


def _conn(name):
    c = sqlite3.connect(_get_path(name))
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def get_accounting_conn(): return _conn('accounting')
def get_hr_conn():         return _conn('hr')
def get_inventory_conn():  return _conn('inventory')


# ─── ACCOUNTING SCHEMA ────────────────────────────────────────────────────────
def init_accounting():
    conn = get_accounting_conn()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        account_id INTEGER,
        reference TEXT,
        status TEXT DEFAULT 'posted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT,
        amount REAL NOT NULL,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        status TEXT DEFAULT 'draft',
        due_date TEXT,
        paid_date TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        category TEXT NOT NULL,
        allocated REAL NOT NULL,
        spent REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        debit_account TEXT,
        credit_account TEXT,
        amount REAL NOT NULL,
        reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tax_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        due_date TEXT,
        filed_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()

    # Seed if empty
    if cur.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0:
        _seed_accounting(conn, cur)

    conn.close()


def _seed_accounting(conn, cur):
    accounts = [
        ('1001', 'Cash & Cash Equivalents', 'asset', 285000),
        ('1002', 'Accounts Receivable', 'asset', 142000),
        ('1003', 'Prepaid Expenses', 'asset', 18500),
        ('2001', 'Accounts Payable', 'liability', 67000),
        ('2002', 'Short-term Loans', 'liability', 120000),
        ('3001', "Owner's Equity", 'equity', 350000),
        ('4001', 'Sales Revenue', 'revenue', 0),
        ('4002', 'Service Revenue', 'revenue', 0),
        ('5001', 'Salaries Expense', 'expense', 0),
        ('5002', 'Marketing Expense', 'expense', 0),
        ('5003', 'Operations Expense', 'expense', 0),
        ('5004', 'Technology Expense', 'expense', 0),
    ]
    cur.executemany("INSERT INTO accounts (code,name,type,balance) VALUES (?,?,?,?)", accounts)

    # Generate 12 months of transactions
    now = datetime.now()
    categories = ['Sales', 'Services', 'Marketing', 'Salaries', 'Operations', 'Technology']
    for i in range(90):
        d = (now - timedelta(days=i*4)).strftime('%Y-%m-%d')
        is_income = random.random() > 0.45
        amt = round(random.uniform(1200, 28000), 2)
        ttype = 'income' if is_income else 'expense'
        cat = random.choice(['Sales', 'Services']) if is_income else random.choice(['Marketing', 'Salaries', 'Operations', 'Technology'])
        cur.execute("INSERT INTO transactions (date,description,amount,type,category,status) VALUES (?,?,?,?,?,?)",
                    (d, f"{cat} {'payment' if is_income else 'expense'} - Ref#{1000+i}", amt, ttype, cat, 'posted'))

    # Invoices
    clients = ['Apex Corp', 'Nova Industries', 'Blue Ridge LLC', 'Summit Technologies', 'Vertex Solutions', 'Pioneer Group']
    statuses = ['paid', 'paid', 'paid', 'sent', 'overdue', 'draft']
    for i in range(24):
        d = (now - timedelta(days=i*12)).strftime('%Y-%m-%d')
        due = (now - timedelta(days=i*12 - 30)).strftime('%Y-%m-%d')
        amt = round(random.uniform(2000, 45000), 2)
        tax = round(amt * 0.15, 2)
        st = statuses[i % len(statuses)]
        paid = d if st == 'paid' else None
        cur.execute("INSERT INTO invoices (invoice_number,client_name,amount,tax,total,status,due_date,paid_date) VALUES (?,?,?,?,?,?,?,?)",
                    (f"INV-{2026001+i}", clients[i % len(clients)], amt, tax, amt+tax, st, due, paid))

    # Budgets for current year
    budget_cats = ['Marketing', 'Salaries', 'Operations', 'Technology', 'R&D', 'Travel']
    for q in ['2026-Q1', '2026-Q2']:
        for cat in budget_cats:
            alloc = round(random.uniform(20000, 120000), 0)
            spent = round(alloc * random.uniform(0.4, 1.05), 0)
            cur.execute("INSERT INTO budgets (period,category,allocated,spent) VALUES (?,?,?,?)", (q, cat, alloc, spent))

    conn.commit()


# ─── HR SCHEMA ───────────────────────────────────────────────────────────────
def init_hr():
    conn = get_hr_conn()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        department TEXT NOT NULL,
        position TEXT NOT NULL,
        salary REAL,
        hire_date TEXT,
        status TEXT DEFAULT 'active',
        phone TEXT,
        address TEXT,
        manager TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        hours REAL,
        status TEXT DEFAULT 'present',
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS payroll (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        period TEXT NOT NULL,
        base_salary REAL,
        overtime REAL DEFAULT 0,
        deductions REAL DEFAULT 0,
        bonuses REAL DEFAULT 0,
        net_pay REAL,
        status TEXT DEFAULT 'pending',
        payment_date TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS performance_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        period TEXT NOT NULL,
        rating INTEGER,
        goals_met INTEGER,
        strengths TEXT,
        improvements TEXT,
        reviewer TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS training (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        course TEXT NOT NULL,
        provider TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'enrolled',
        score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
    """)
    conn.commit()

    if cur.execute("SELECT COUNT(*) FROM employees").fetchone()[0] == 0:
        _seed_hr(conn, cur)

    conn.close()


def _seed_hr(conn, cur):
    departments = ['Engineering', 'Finance', 'Marketing', 'Operations', 'HR', 'Sales']
    positions = {
        'Engineering': ['Senior Engineer', 'Junior Developer', 'DevOps Specialist', 'QA Engineer'],
        'Finance': ['Financial Analyst', 'Accountant', 'Controller', 'CFO'],
        'Marketing': ['Marketing Manager', 'Content Specialist', 'SEO Analyst', 'Designer'],
        'Operations': ['Operations Manager', 'Business Analyst', 'Process Engineer'],
        'HR': ['HR Manager', 'Recruiter', 'Training Coordinator', 'HR Analyst'],
        'Sales': ['Sales Manager', 'Account Executive', 'Sales Rep', 'BD Manager'],
    }
    names = [
        'James Wilson', 'Sarah Chen', 'Mohammed Al-Rashid', 'Emma Thompson', 'Carlos Rivera',
        'Aisha Patel', 'Lucas Müller', 'Yuki Tanaka', 'Fatima Hassan', 'Daniel Smith',
        'Grace Kim', 'Omar Abdullah', 'Isabella Rossi', 'Liam Johnson', 'Sofia Martinez',
        'Ethan Brown', 'Amara Diallo', 'Noah Garcia', 'Zoe Williams', 'Hiroshi Yamamoto',
        'Chloe Davis', 'Ali Hassan', 'Mia Anderson', 'Joshua Taylor', 'Layla Nasser',
        'Benjamin Moore', 'Ava Jackson', 'Elijah White', 'Charlotte Harris', 'Oliver Martin',
    ]

    now = datetime.now()
    emp_ids = []
    for i, name in enumerate(names):
        dept = departments[i % len(departments)]
        pos = positions[dept][i % len(positions[dept])]
        sal = round(random.uniform(45000, 145000), 0)
        hire = (now - timedelta(days=random.randint(30, 1800))).strftime('%Y-%m-%d')
        status = 'active' if random.random() > 0.08 else 'on-leave'
        email = f"{name.lower().replace(' ', '.').replace('-', '')}@company.com"
        emp_id = f"EMP{1000+i}"
        cur.execute("""INSERT INTO employees (employee_id,name,email,department,position,salary,hire_date,status,manager)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (emp_id, name, email, dept, pos, sal, hire, status, 'HR Manager'))
        emp_ids.append(i + 1)

    # Attendance for last 30 days
    for emp_id in emp_ids[:20]:
        for day in range(30):
            d = (now - timedelta(days=day)).strftime('%Y-%m-%d')
            if datetime.strptime(d, '%Y-%m-%d').weekday() < 5:
                status = random.choices(['present', 'present', 'present', 'late', 'absent'], weights=[70, 10, 10, 10, 5])[0]
                ci = f"0{random.randint(7,9)}:{random.randint(0,59):02d}:00" if status != 'absent' else None
                co = f"1{random.randint(6,8)}:{random.randint(0,59):02d}:00" if status != 'absent' else None
                hrs = round(random.uniform(7.5, 9.5), 1) if ci else 0
                cur.execute("INSERT INTO attendance (employee_id,date,check_in,check_out,hours,status) VALUES (?,?,?,?,?,?)",
                            (emp_id, d, ci, co, hrs, status))

    # Payroll for last 3 months
    for emp_id in emp_ids:
        cur.execute("SELECT salary FROM employees WHERE id=?", (emp_id,))
        base = cur.fetchone()[0]
        for m in range(3):
            period = (now - timedelta(days=30*m)).strftime('%Y-%m')
            ot = round(random.uniform(0, 1200), 0)
            ded = round(base * 0.12, 0)
            bon = round(random.uniform(0, 2000), 0)
            net = base / 12 + ot - ded + bon
            st = 'paid' if m > 0 else 'pending'
            cur.execute("INSERT INTO payroll (employee_id,period,base_salary,overtime,deductions,bonuses,net_pay,status) VALUES (?,?,?,?,?,?,?,?)",
                        (emp_id, period, round(base/12, 0), ot, ded, bon, round(net, 0), st))

    # Leave requests
    leave_types = ['annual', 'sick', 'unpaid', 'maternity']
    for emp_id in random.sample(emp_ids, 12):
        start = (now - timedelta(days=random.randint(5, 60))).strftime('%Y-%m-%d')
        days = random.randint(1, 10)
        end = (datetime.strptime(start, '%Y-%m-%d') + timedelta(days=days)).strftime('%Y-%m-%d')
        st = random.choice(['approved', 'approved', 'pending', 'rejected'])
        cur.execute("INSERT INTO leave_requests (employee_id,type,start_date,end_date,days,reason,status) VALUES (?,?,?,?,?,?,?)",
                    (emp_id, random.choice(leave_types), start, end, days, 'Personal reasons', st))

    # Performance reviews
    for emp_id in emp_ids:
        cur.execute("INSERT INTO performance_reviews (employee_id,period,rating,goals_met,strengths,improvements,reviewer) VALUES (?,?,?,?,?,?,?)",
                    (emp_id, '2026-Q1', random.randint(2, 5), random.randint(60, 100),
                     'Strong collaboration, technical excellence', 'Communication, time management',
                     'Department Manager'))

    conn.commit()


# ─── INVENTORY SCHEMA ─────────────────────────────────────────────────────────
def init_inventory():
    conn = get_inventory_conn()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        lead_time INTEGER DEFAULT 7,
        reliability_score REAL DEFAULT 80.0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER,
        unit_cost REAL,
        sell_price REAL,
        quantity INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 10,
        supplier_id INTEGER,
        location TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference TEXT,
        reason TEXT,
        date TEXT NOT NULL,
        performed_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        supplier_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_cost REAL,
        total REAL,
        status TEXT DEFAULT 'pending',
        expected_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );
    """)
    conn.commit()

    if cur.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
        _seed_inventory(conn, cur)

    conn.close()


def _seed_inventory(conn, cur):
    cats = [('Electronics', 'Electronic components and devices'),
            ('Raw Materials', 'Base manufacturing inputs'),
            ('Finished Goods', 'Ready-to-ship products'),
            ('Office Supplies', 'Administrative consumables'),
            ('Packaging', 'Boxes, wraps, and containers')]
    for name, desc in cats:
        cur.execute("INSERT INTO categories (name,description) VALUES (?,?)", (name, desc))

    suppliers = [
        ('TechParts Global', 'supply@techparts.com', '+1-555-0101', 'New York, USA', 5, 94.5),
        ('RawMat Industries', 'orders@rawmat.com', '+1-555-0102', 'Chicago, USA', 14, 87.2),
        ('SwiftSupply Co', 'sales@swiftsupply.com', '+1-555-0103', 'Dallas, USA', 7, 91.8),
        ('AlphaLogistics Ltd', 'orders@alpha.com', '+44-20-5555', 'London, UK', 21, 82.3),
        ('EastPack Solutions', 'info@eastpack.com', '+1-555-0104', 'Seattle, USA', 10, 88.6),
    ]
    for s in suppliers:
        cur.execute("INSERT INTO suppliers (name,email,phone,address,lead_time,reliability_score) VALUES (?,?,?,?,?,?)", s)

    now = datetime.now()
    product_data = [
        ('SKU-E001', 'Laptop Pro 15"', 1, 850, 1299, random.randint(15, 120), 10, 1),
        ('SKU-E002', 'Wireless Mouse', 1, 12, 29.99, random.randint(50, 400), 25, 1),
        ('SKU-E003', 'USB-C Hub 7-Port', 1, 18, 45, random.randint(8, 95), 15, 3),
        ('SKU-E004', 'Mechanical Keyboard', 1, 65, 129, random.randint(20, 150), 12, 1),
        ('SKU-E005', 'Monitor 27" 4K', 1, 380, 649, random.randint(5, 45), 8, 3),
        ('SKU-R001', 'Steel Sheet 2mm', 2, 45, 82, random.randint(100, 800), 50, 2),
        ('SKU-R002', 'Aluminum Alloy Bars', 2, 78, 135, random.randint(80, 600), 60, 2),
        ('SKU-R003', 'Copper Wire Spool', 2, 120, 210, random.randint(30, 200), 20, 2),
        ('SKU-F001', 'Widget Pro A1', 3, 22, 49.99, random.randint(200, 1200), 100, 3),
        ('SKU-F002', 'Component Set B2', 3, 15, 34.99, random.randint(150, 800), 80, 3),
        ('SKU-F003', 'Gadget X5', 3, 95, 189, random.randint(40, 300), 25, 1),
        ('SKU-O001', 'Printer Paper A4 (500)', 4, 4.5, 9.99, random.randint(100, 600), 50, 5),
        ('SKU-O002', 'Ballpoint Pens (Box)', 4, 3.2, 7.5, random.randint(80, 400), 40, 5),
        ('SKU-O003', 'Stapler Heavy Duty', 4, 8, 18, random.randint(15, 80), 10, 5),
        ('SKU-P001', 'Cardboard Boxes Med', 5, 1.8, 4.5, random.randint(200, 2000), 100, 5),
        ('SKU-P002', 'Bubble Wrap Roll 50m', 5, 12, 26, random.randint(30, 200), 20, 5),
    ]
    for p in product_data:
        loc = random.choice(['Warehouse A', 'Warehouse B', 'Shelf C', 'Cold Storage', 'Zone D'])
        cur.execute("INSERT INTO products (sku,name,category_id,unit_cost,sell_price,quantity,reorder_level,supplier_id,location) VALUES (?,?,?,?,?,?,?,?,?)",
                    (*p, loc))

    # Stock movements
    cur.execute("SELECT id, name FROM products")
    products = cur.fetchall()
    for prod in products:
        for j in range(8):
            d = (now - timedelta(days=j * 5 + random.randint(0, 4))).strftime('%Y-%m-%d')
            mtype = random.choice(['in', 'in', 'out', 'out', 'out'])
            qty = random.randint(5, 80)
            cur.execute("INSERT INTO stock_movements (product_id,type,quantity,reference,reason,date,performed_by) VALUES (?,?,?,?,?,?,?)",
                        (prod['id'], mtype, qty, f"REF-{random.randint(10000,99999)}",
                         'Restock' if mtype == 'in' else 'Customer Order', d, 'Warehouse Staff'))

    # Purchase orders
    po_statuses = ['received', 'received', 'confirmed', 'pending', 'pending']
    for i in range(10):
        d = (now - timedelta(days=i * 8)).strftime('%Y-%m-%d')
        exp = (now + timedelta(days=random.randint(5, 20))).strftime('%Y-%m-%d')
        prod_id = random.randint(1, len(products))
        sup_id = random.randint(1, 5)
        qty = random.randint(50, 500)
        cost = round(random.uniform(5, 100), 2)
        cur.execute("INSERT INTO purchase_orders (po_number,supplier_id,product_id,quantity,unit_cost,total,status,expected_date) VALUES (?,?,?,?,?,?,?,?)",
                    (f"PO-{2026100+i}", sup_id, prod_id, qty, cost, qty * cost, po_statuses[i % len(po_statuses)], exp))

    conn.commit()


# ─── Universal CRUD helpers ───────────────────────────────────────────────────
def sub_get_all(conn_fn, table, limit=200):
    conn = conn_fn()
    try:
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def sub_get_one(conn_fn, table, row_id):
    conn = conn_fn()
    try:
        row = conn.execute(f"SELECT * FROM {table} WHERE id=?", (row_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def sub_create(conn_fn, table, data):
    conn = conn_fn()
    try:
        keys = ', '.join(data.keys())
        placeholders = ', '.join(['?'] * len(data))
        conn.execute(f"INSERT INTO {table} ({keys}) VALUES ({placeholders})", list(data.values()))
        conn.commit()
        return conn.execute(f"SELECT last_insert_rowid()").fetchone()[0]
    finally:
        conn.close()


def sub_update(conn_fn, table, row_id, data):
    conn = conn_fn()
    try:
        sets = ', '.join([f"{k}=?" for k in data.keys()])
        conn.execute(f"UPDATE {table} SET {sets} WHERE id=?", list(data.values()) + [row_id])
        conn.commit()
    finally:
        conn.close()


def sub_delete(conn_fn, table, row_id):
    conn = conn_fn()
    try:
        conn.execute(f"DELETE FROM {table} WHERE id=?", (row_id,))
        conn.commit()
    finally:
        conn.close()


def init_all_subsystems():
    print("Initializing Accounting subsystem...")
    init_accounting()
    print("Initializing HR subsystem...")
    init_hr()
    print("Initializing Inventory subsystem...")
    init_inventory()
    print("All subsystems ready.")
