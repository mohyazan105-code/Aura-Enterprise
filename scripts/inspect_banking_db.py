import sqlite3, os

DB = os.path.join(os.path.dirname(__file__), '..', 'database', 'banking.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=== CUSTOMERS ===")
cur.execute("SELECT id, name, email, phone, company, type, status, password_hash FROM customers")
for r in cur.fetchall():
    has_pw = "YES" if r["password_hash"] else "NO"
    print(f"  [{r['id']}] {r['name']} | {r['email']} | {r['company']} | pw:{has_pw}")

print("\n=== BANK ACCOUNTS ===")
cur.execute("""
    SELECT a.acc_id, a.user_id, a.account_no, a.account_type, a.account_tier,
           a.balance_available, a.balance_ledger, a.account_status,
           c.name as cname
    FROM Bank_Accounts a
    LEFT JOIN customers c ON a.user_id = c.id
    ORDER BY a.user_id
""")
for r in cur.fetchall():
    print(f"  acc_{r['acc_id']} uid={r['user_id']} ({r['cname']}) | {r['account_no']} | {r['account_type']} {r['account_tier']} | bal=${r['balance_available']:,.2f} | {r['account_status']}")

print("\n=== CREDIT CARDS ===")
cur.execute("SELECT card_id, account_id, card_brand, card_number_masked, credit_limit_assigned, current_outstanding_balance, card_status FROM Bank_Credit_Cards_Master")
for r in cur.fetchall():
    print(f"  card_{r['card_id']} acc={r['account_id']} | {r['card_brand']} {r['card_number_masked']} | limit=${r['credit_limit_assigned']:,.0f} | outstanding=${r['current_outstanding_balance']:,.2f} | {r['card_status']}")

print("\n=== LOANS ===")
cur.execute("SELECT loan_id, user_id, loan_product_type, principal_amount, remaining_balance, loan_status FROM Bank_Loans_Advanced")
for r in cur.fetchall():
    print(f"  loan_{r['loan_id']} uid={r['user_id']} | {r['loan_product_type']} | ${r['principal_amount']:,.0f} | rem=${r['remaining_balance']:,.0f} | {r['loan_status']}")

print("\n=== TRANSACTIONS (first 15) ===")
cur.execute("SELECT trans_id, from_account_id, to_account_id, amount_original_curr, trans_category, description_text, created_at FROM Bank_Transactions_Detail LIMIT 15")
for r in cur.fetchall():
    print(f"  tx_{r['trans_id']} from={r['from_account_id']} to={r['to_account_id']} | ${r['amount_original_curr']:,.2f} | {r['trans_category']} | {r['description_text']}")

conn.close()
