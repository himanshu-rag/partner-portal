from etl_script import GoogleSheetsClient, DataTransformer, DatabaseClient, BACKUP_SHEET_NAME, RENEWAL_SHEET_NAME

sheets = GoogleSheetsClient()
backup_df = sheets.fetch_worksheet_data(BACKUP_SHEET_NAME)
renewal_df = sheets.fetch_worksheet_data(RENEWAL_SHEET_NAME)

transformer = DataTransformer()
final_records = transformer.transform(backup_df, renewal_df)

db = DatabaseClient()
existing_records = db.fetch_all_records() if hasattr(db, 'fetch_all_records') else set()
# Wait, fetch_all_records is inside insert_new_records.
# Let's just run the code from insert_new_records
from sqlalchemy import select
with db.Session() as session:
    result = session.execute(select(db.table))
    row = result.first()
    row_dict = row._mapping
    print("----- DATABASE FIRST ROW TUPLE -----")
    record_tuple = (
        str(row_dict.get(db.col_map.get("Partner", "Partner"), "")),
        str(row_dict.get(db.col_map.get("Customer Name", "Customer Name"), "")),
        str(row_dict.get(db.col_map.get("Customer ID", "Customer ID"), "")),
        str(row_dict.get(db.col_map.get("Backup Storage (GB)", "Backup Storage (GB)"), "")),
        str(row_dict.get(db.col_map.get("Activation Date", "Activation Date"), "")),
        str(row_dict.get(db.col_map.get("Status", "Status"), "")),
        str(row_dict.get(db.col_map.get("Renewal Date", "Renewal Date"), "")),
        str(row_dict.get(db.col_map.get("Size Increased", "Size Increased"), ""))
    )
    print(record_tuple)
    print("Type of Storage:", type(row_dict.get(db.col_map.get("Backup Storage (GB)"))))
    print("Type of Date:", type(row_dict.get(db.col_map.get("Activation Date"))))

    print("\n----- GENERATED FIRST RECORD TUPLE -----")
    record = final_records[0]
    gen_tuple = (
        str(record.get("Partner") if record.get("Partner") is not None else ""),
        str(record.get("Customer Name") if record.get("Customer Name") is not None else ""),
        str(record.get("Customer ID") if record.get("Customer ID") is not None else ""),
        str(record.get("Backup Storage (GB)") if record.get("Backup Storage (GB)") is not None else ""),
        str(record.get("Activation Date") if record.get("Activation Date") is not None else ""),
        str(record.get("Status") if record.get("Status") is not None else ""),
        str(record.get("Renewal Date") if record.get("Renewal Date") is not None else ""),
        str(record.get("Size Increased") if record.get("Size Increased") is not None else "")
    )
    print(gen_tuple)
