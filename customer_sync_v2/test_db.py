from sqlalchemy import create_engine, text
engine = create_engine("mysql+pymysql://nsjao4ka93qod:%24Y%298v%2A%3Cj%21g3%5BtruG%2Ais%7C%5B-9t8N9%5D@common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com:3306/customer_success_db")
with engine.connect() as conn:
    result = conn.execute(text("SELECT customer_name, backup_storage_gb, customer_id FROM backup_history WHERE partner_email = 'admin@amsantechnology.com'"))
    
    seen_ids = set()
    for row in result:
        cid = str(row[2]).strip()
        if cid in seen_ids:
            print(f"Duplicate customer_id found! {cid} for {row[0]}")
        seen_ids.add(cid)
