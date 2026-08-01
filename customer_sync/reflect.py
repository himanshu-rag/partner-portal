from sqlalchemy import create_engine, MetaData
from urllib.parse import quote_plus
password = quote_plus("$Y)8v*<j!g3[truG*is|[-9t8N9]")
engine = create_engine(f"mysql+pymysql://nsjao4ka93qod:{password}@common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com:3306/customer_success_db")
m = MetaData()
m.reflect(bind=engine, only=['backup_history'])
table = m.tables['backup_history']
print("COLUMNS:")
for c in table.columns:
    print(c.name)
