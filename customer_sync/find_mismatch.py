from etl_script import GoogleSheetsClient, DataTransformer, DatabaseClient, BACKUP_SHEET_NAME, RENEWAL_SHEET_NAME

sheets = GoogleSheetsClient()
backup_df = sheets.fetch_worksheet_data(BACKUP_SHEET_NAME)
renewal_df = sheets.fetch_worksheet_data(RENEWAL_SHEET_NAME)

transformer = DataTransformer()
final_records = transformer.transform(backup_df, renewal_df)

db = DatabaseClient()

from sqlalchemy import select
with db.Session() as session:
    result = session.execute(select(db.table))
    
    db_records = set()
    for row in result:
        record_tuple = (
            str(row._mapping.get(db.col_map.get("Partner", "Partner")) or ""),
            str(row._mapping.get(db.col_map.get("Customer Name", "Customer Name")) or ""),
            str(row._mapping.get(db.col_map.get("Customer ID", "Customer ID")) or ""),
            str(row._mapping.get(db.col_map.get("Backup Storage (GB)", "Backup Storage (GB)")) or ""),
            str(row._mapping.get(db.col_map.get("Activation Date", "Activation Date")) or ""),
            str(row._mapping.get(db.col_map.get("Status", "Status")) or ""),
            str(row._mapping.get(db.col_map.get("Renewal Date", "Renewal Date")) or ""),
            str(row._mapping.get(db.col_map.get("Size Increased", "Size Increased")) or "")
        )
        db_records.add(record_tuple)
        
    mismatches = []
    for record in final_records:
        record_tuple = (
            str(record.get("Partner") if record.get("Partner") is not None else ""),
            str(record.get("Customer Name") if record.get("Customer Name") is not None else ""),
            str(record.get("Customer ID") if record.get("Customer ID") is not None else ""),
            str(record.get("Backup Storage (GB)") if record.get("Backup Storage (GB)") is not None else ""),
            str(record.get("Activation Date") if record.get("Activation Date") is not None else ""),
            str(record.get("Status") if record.get("Status") is not None else ""),
            str(record.get("Renewal Date") if record.get("Renewal Date") is not None else ""),
            str(record.get("Size Increased") if record.get("Size Increased") is not None else "")
        )
        if record_tuple not in db_records:
            mismatches.append(record_tuple)

    print(f"Total Mismatches: {len(mismatches)}")
    if mismatches:
        print("First mismatch:")
        print(mismatches[0])
        
        # Try to find the closest match in DB
        print("Closest match in DB:")
        for db_r in db_records:
            if db_r[2] == mismatches[0][2]: # match on customer_id
                print(db_r)
                print("Differences:")
                for i in range(8):
                    if db_r[i] != mismatches[0][i]:
                        print(f"Index {i}: DB='{db_r[i]}' vs NEW='{mismatches[0][i]}'")
                break
