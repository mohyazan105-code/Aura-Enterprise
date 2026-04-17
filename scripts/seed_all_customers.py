"""
seed_all_customers.py
Ensures all 10 banking customers have comprehensive, realistic data:
  - Checking + Savings accounts with real balances
  - Credit cards
  - 15+ transactions each
  - Active loans
  - Campaign enrollment (where eligible)
"""
import sqlite3, os, random, hashlib
from datetime import datetime, timedelta

DB = os.path.join(os.path.dirname(__file__), '..', 'database', 'banking.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys=ON")
cur = conn.cursor()

def h(p): return hashlib.sha256(p.encode()).hexdigest()

# ── Customer master list ───────────────────────────────────────────────────────
CUSTOMERS = [
    (1,  "Sarah Connor",   "sarah.connor@client.com",   "Connor Corp",     "individual"),
    (2,  "John Doe",       "john.doe@client.com",       "Doe Enterprises",  "corporate"),
    (3,  "Alice Smith",    "alice.smith@client.com",    "Smith Holdings",   "corporate"),
    (4,  "Bob Johnson",    "bob.johnson@client.com",    "Johnson LLC",      "individual"),
    (5,  "Carol White",    "carol.white@client.com",    "White Partners",  "individual"),
    (6,  "David Brown",    "david.brown@client.com",    "Brown & Co",      "corporate"),
    (7,  "Eve Davis",      "eve.davis@client.com",      "Davis Corp",      "individual"),
    (8,  "Frank Wilson",   "frank.wilson@client.com",   "Wilson Group",    "corporate"),
    (9,  "Grace Lee",      "grace.lee@client.com",      "Lee Industries",  "individual"),
    (10, "Henry Clark",    "henry.clark@client.com",    "Clark Capital",   "corporate"),
]

# Ensure all customers have password & correct data
for cid, name, email, company, ctype in CUSTOMERS:
    cur.execute("SELECT id FROM customers WHERE id=?", (cid,))
    if cur.fetchone():
        cur.execute("""UPDATE customers SET name=?, email=?, company=?, type=?,
                        password_hash=?, status='active' WHERE id=?""",
                    (name, email, company, ctype, h("pass123"), cid))
    else:
        cur.execute("""INSERT INTO customers (id, name, email, company, type, password_hash, status)
                       VALUES (?,?,?,?,?,?,'active')""",
                    (cid, name, email, company, ctype, h("pass123")))
print("  Customers upserted.")

# ── Clear old placeholder accounts for these 10 ───────────────────────────────
cur.execute("DELETE FROM Bank_Accounts WHERE account_no LIKE 'ACC-100-%'")

# ── Account templates per customer ────────────────────────────────────────────
ACCOUNT_PLANS = {
    1:  [("Checking","Standard","AURA-SC-001",  25000,  50000),
         ("Savings", "Gold",    "AURA-SC-002", 180000, 180000)],
    2:  [("Checking","Platinum","AURA-JD-001", 320000, 320000),
         ("Savings", "Gold",    "AURA-JD-002", 145000, 145000),
         ("Business Current","Gold","AURA-JD-003", 890000, 890000)],
    3:  [("Checking","Gold",    "AURA-AS-001", 75000,  75000),
         ("Savings", "Platinum","AURA-AS-002", 425000, 425000)],
    4:  [("Checking","Standard","AURA-BJ-001",  12000,  12000),
         ("Savings", "Standard","AURA-BJ-002",  55000,  55000)],
    5:  [("Checking","Standard","AURA-CW-001",   8500,   8500),
         ("Savings", "Silver",  "AURA-CW-002",  34000,  34000)],
    6:  [("Checking","Gold",    "AURA-DB-001", 195000, 195000),
         ("Business Current","Platinum","AURA-DB-002", 1200000, 1200000)],
    7:  [("Checking","Standard","AURA-ED-001",  18000,  18000),
         ("Savings", "Silver",  "AURA-ED-002",  62000,  62000)],
    8:  [("Checking","Gold",    "AURA-FW-001",  88000,  88000),
         ("Savings", "Gold",    "AURA-FW-002", 230000, 230000)],
    9:  [("Checking","Silver",  "AURA-GL-001",  31000,  31000),
         ("Savings", "Standard","AURA-GL-002",  97000,  97000)],
    10: [("Checking","Platinum","AURA-HC-001", 450000, 450000),
         ("Business Current","Platinum","AURA-HC-002", 3200000, 3200000)],
}

# Build account_no → acc_id map (existing)
cur.execute("SELECT acc_id, account_no FROM Bank_Accounts")
existing_accs = {r['account_no']: r['acc_id'] for r in cur.fetchall()}

account_ids = {}  # cid → [acc_id, ...]

for cid, plans in ACCOUNT_PLANS.items():
    account_ids[cid] = []
    for (atype, tier, acc_no, bal_avail, bal_ledger) in plans:
        if acc_no in existing_accs:
            aid = existing_accs[acc_no]
            cur.execute("""UPDATE Bank_Accounts SET balance_available=?, balance_ledger=?,
                            account_status='active', account_tier=?, account_type=?
                           WHERE acc_id=?""",
                        (bal_avail, bal_ledger, tier, atype, aid))
        else:
            cur.execute("""INSERT INTO Bank_Accounts
                (user_id, account_no, account_type, account_tier, currency_id,
                 balance_available, balance_ledger, account_status, kyc_status,
                 overdraft_limit, daily_transfer_limit, opening_date, last_activity_at)
                VALUES (?,?,?,?,'USD',?,?,'active','verified',1000,50000,
                        datetime('now','-'||?||' days'),datetime('now'))""",
                       (cid, acc_no, atype, tier, bal_avail, bal_ledger,
                        random.randint(90, 900)))
            aid = cur.lastrowid
        account_ids[cid].append(aid)

print("  Accounts seeded.")

# ── Credit Cards ──────────────────────────────────────────────────────────────
CARD_BRANDS = ["Visa Platinum","Mastercard Gold","Visa Classic","Amex Black","Mastercard Platinum"]

# Remove old cards for these customers' accounts
all_acc_ids = [aid for aids in account_ids.values() for aid in aids]
if all_acc_ids:
    placeholders = ",".join("?" * len(all_acc_ids))
    cur.execute(f"SELECT card_id FROM Bank_Credit_Cards_Master WHERE account_id IN ({placeholders})", all_acc_ids)
    old_cards = [r['card_id'] for r in cur.fetchall()]
    if old_cards:
        cur.execute(f"DELETE FROM Bank_Credit_Cards_Master WHERE card_id IN ({','.join('?'*len(old_cards))})", old_cards)

CARD_LIMITS = {
    "Standard": (5000, 15000), "Silver": (10000, 25000), "Gold": (25000, 75000),
    "Platinum": (75000, 200000), "None": (3000, 8000)
}

for cid, aids in account_ids.items():
    primary_aid = aids[0]
    # Get tier from account plans
    tier = ACCOUNT_PLANS[cid][0][1]
    lo, hi = CARD_LIMITS.get(tier, (5000, 20000))
    credit_limit = random.randint(lo, hi)
    outstanding  = round(random.uniform(0.05, 0.45) * credit_limit, 2)
    masked = f"****-****-****-{random.randint(1000,9999)}"
    brand = random.choice(CARD_BRANDS)
    expiry = f"{random.randint(1,12):02d}/{random.randint(27,31)}"
    cur.execute("""INSERT INTO Bank_Credit_Cards_Master
        (account_id, card_brand, card_number_masked, expiry_date, cvv_encrypted,
         credit_limit_assigned, current_outstanding_balance, reward_points_balance,
         is_contactless_enabled, card_status)
        VALUES (?,?,?,?,'ENC',?,?,?,1,'active')""",
               (primary_aid, brand, masked, expiry, credit_limit, outstanding,
                random.randint(500, 15000)))

print("  Credit cards seeded.")

# ── Transactions (15 per customer) ────────────────────────────────────────────
TX_TYPES = [
    ("Salary Credit",     "credit",            35000,  85000),
    ("Online Purchase",   "debit",              50,    3500),
    ("ATM Withdrawal",    "debit",             100,    2000),
    ("Utility Payment",   "debit",             100,     800),
    ("Bank Transfer",     "transfer",          500,   25000),
    ("Loan Installment",  "loan_payment",      800,    5000),
    ("Interest Credit",   "interest",           10,     500),
    ("Dividend Payment",  "credit",            200,    8000),
    ("Restaurant",        "debit",              20,     300),
    ("Shopping",          "debit",              50,    2000),
    ("Subscription",      "debit",               5,      50),
    ("Insurance Premium", "debit",             200,    1500),
    ("Freelance Payment", "credit",            500,   12000),
    ("Rent Payment",      "debit",            1200,    8000),
    ("Investment Transfer","transfer",        1000,   50000),
]

for cid, aids in account_ids.items():
    primary_aid = aids[0]
    # Remove old transactions for these accounts
    acc_ph = ",".join("?" * len(aids))
    cur.execute(f"DELETE FROM Bank_Transactions_Detail WHERE from_account_id IN ({acc_ph}) OR to_account_id IN ({acc_ph})", aids + aids)

    for i in range(20):
        tx = random.choice(TX_TYPES)
        desc, category, lo, hi = tx
        amount = round(random.uniform(lo, hi), 2)
        days_ago = random.randint(1, 180)
        ts = (datetime.now() - timedelta(days=days_ago, hours=random.randint(0,23))).isoformat()

        if category == "credit":
            from_acc = random.choice([a for a in all_acc_ids if a != primary_aid] + [None])
            to_acc = primary_aid
        else:
            from_acc = primary_aid
            to_acc = random.choice([a for a in all_acc_ids if a != primary_aid] or [None])

        cur.execute("""INSERT INTO Bank_Transactions_Detail
            (from_account_id, to_account_id, amount_original_curr, exchange_rate_applied,
             trans_category, trans_status, description_text, fraud_score, created_at)
            VALUES (?,?,?,1.0,?,?,?,?,?)""",
                   (from_acc, to_acc, amount, category, "Completed",
                    desc, round(random.uniform(0, 5), 2), ts))

print("  Transactions seeded (20 per customer).")

# ── Loans ─────────────────────────────────────────────────────────────────────
LOAN_TYPES = ["Personal", "Mortgage", "Auto", "Business", "Education"]
LOAN_STATUS = ["approved", "disbursed", "under_review", "pending"]

# Ensure each customer has at least 1-2 active loans
for cid, aids in account_ids.items():
    cur.execute("SELECT COUNT(*) as cnt FROM Bank_Loans_Advanced WHERE user_id=?", (cid,))
    existing = cur.fetchone()['cnt']
    target = random.randint(1, 3)
    for _ in range(max(0, target - existing)):
        principal = round(random.uniform(10000, 350000), 2)
        rate = round(random.uniform(3.5, 12.5), 2)
        term = random.choice([12, 24, 36, 48, 60, 120, 180, 240])
        remaining = round(principal * random.uniform(0.3, 0.95), 2)
        status = random.choice(LOAN_STATUS)
        next_payment = (datetime.now() + timedelta(days=random.randint(5, 35))).strftime("%Y-%m-%d")
        cur.execute("""INSERT INTO Bank_Loans_Advanced
            (user_id, loan_product_type, principal_amount, interest_rate_fixed_variable,
             amortization_period_months, remaining_balance, loan_status,
             next_payment_date, credit_score_on_approval, total_paid_to_date, late_fee_percentage)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                   (cid, random.choice(LOAN_TYPES), principal, rate, term,
                    remaining, status, next_payment, random.randint(620, 820),
                    round(principal - remaining, 2), round(random.uniform(1.5, 5.0), 2)))

print("  Loans seeded.")
conn.commit()
conn.close()
print("\nDONE - All 10 customers have complete banking profiles!")
print("\nLogin credentials (all use password: pass123):")
for cid, name, email, *_ in CUSTOMERS:
    print(f"  {email}")
