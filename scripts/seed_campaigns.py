"""
seed_campaigns.py
Populates the banking.db with realistic campaign workflow mock data.
Run from the aura/ project root OR directly.
"""
import sqlite3, random, os
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, '..', 'database', 'banking.db')

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys=ON")
cur = conn.cursor()

# ── Clean slate ────────────────────────────────────────────────────────────────
cur.execute("DELETE FROM campaign_fraud_alerts")
cur.execute("DELETE FROM campaign_verifications")
cur.execute("DELETE FROM campaign_participants")
cur.execute("DELETE FROM campaign_definitions")

# ── Insert 3 realistic campaigns ───────────────────────────────────────────────
CAMPAIGNS = [
    ("Summer Cash Bonus ☀️",         150.0,  2000.0,   8000.0,  "active",  30),
    ("Premium Member Rewards 💎",     300.0, 15000.0,  50000.0,  "active",  20),
    ("Digital Banking Kickstart 📱",   75.0,   500.0,   2000.0,  "active",   7),
]

camp_ids = []
for name, reward, min_bal, min_vol, status, days_ago in CAMPAIGNS:
    created = (datetime.now() - timedelta(days=days_ago)).isoformat()
    cur.execute("""
        INSERT INTO campaign_definitions (name, reward_amount, min_balance, min_volume, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (name, reward, min_bal, min_vol, status, created))
    camp_ids.append(cur.lastrowid)
    print(f"  ✓ Campaign [{cur.lastrowid}] '{name}' created")

# ── Pull existing bank accounts ────────────────────────────────────────────────
cur.execute("""
    SELECT a.acc_id, a.user_id, a.balance_available, a.account_no,
           c.name AS customer_name
    FROM Bank_Accounts a
    JOIN customers c ON a.user_id = c.id
""")
accounts = cur.fetchall()

if not accounts:
    print("⚠  No Bank_Accounts found – run app.py first to init seed data.")
    conn.close()
    exit()

print(f"\n  Found {len(accounts)} accounts to sample from.\n")

# ── Status distributions per campaign ─────────────────────────────────────────
DISTRIBUTIONS = [
    # Summer bonus – wide mix
    ['completed','completed','completed','pending_verification','pending_verification',
     'approved','qualified','qualified','rejected'],
    # Premium – fewer but high-value mix
    ['completed','completed','pending_verification','qualified','rejected'],
    # Digital kickstart – mostly qualified (freshly launched)
    ['qualified','qualified','qualified','completed','pending_verification','rejected'],
]

ALERT_TYPES = [
    ('unusual_activity',          'high',   'Automated velocity analysis flagged abnormally high inbound transfers.'),
    ('geo_anomaly',               'medium', 'Login and transaction origin mismatch detected across 3 countries.'),
    ('device_fingerprint_mismatch','high',  'New unrecognised device submitted verification credentials.'),
    ('velocity_spike',            'critical','Transaction volume spiked 400% above 30-day average within 24 h.'),
    ('mismatched_data',           'high',   'Submitted verification data does not match primary KYC record.'),
]

for idx, cid in enumerate(camp_ids):
    dist = DISTRIBUTIONS[idx]
    sample_size = min(len(accounts), len(dist) + random.randint(0, 3))
    pool = random.sample(list(accounts), sample_size)

    for j, acc in enumerate(pool):
        status = dist[j % len(dist)]
        fraud  = 0.0
        risk   = 'low'

        # ~25 % of participants have a raised fraud score
        if random.random() > 0.75:
            fraud = round(random.uniform(45, 96), 2)
            risk  = 'high' if fraud > 75 else 'medium'

        created_at = (datetime.now() - timedelta(days=random.randint(1, 14))).isoformat()

        cur.execute("""
            INSERT INTO campaign_participants
                (campaign_id, account_id, status, fraud_score, risk_level, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (cid, acc['acc_id'], status, fraud, risk, created_at))
        pid = cur.lastrowid

        # Verification records for completed / approved
        if status in ('completed', 'approved'):
            match = round(random.uniform(88, 100), 1)
            cur.execute("""
                INSERT INTO campaign_verifications
                    (participant_id, submitted_name, submitted_account, match_score, status, created_at)
                VALUES (?, ?, ?, ?, 'verified', ?)
            """, (pid, acc['customer_name'], acc['account_no'], match, created_at))

        # Fraud alerts for high-risk participants
        if risk in ('high', 'medium') and fraud > 55:
            alert = random.choice(ALERT_TYPES)
            ts = (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat()
            cur.execute("""
                INSERT INTO campaign_fraud_alerts
                    (participant_id, alert_type, severity, description, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (pid, alert[0], alert[1], alert[2], ts))

        # Credit reward balance to completed accounts
        if status == 'completed':
            camp_row = cur.execute(
                "SELECT reward_amount FROM campaign_definitions WHERE id=?", (cid,)
            ).fetchone()
            if camp_row:
                cur.execute("""
                    UPDATE Bank_Accounts
                    SET balance_available = balance_available + ?,
                        balance_ledger    = balance_ledger    + ?
                    WHERE acc_id = ?
                """, (camp_row['reward_amount'], camp_row['reward_amount'], acc['acc_id']))

    participant_count = cur.execute(
        "SELECT COUNT(*) FROM campaign_participants WHERE campaign_id=?", (cid,)
    ).fetchone()[0]
    print(f"  ✓ Campaign [{cid}] – {participant_count} participants seeded")

conn.commit()
conn.close()
print("\n✅  Campaign mock data seeded successfully!\n")
