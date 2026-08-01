import pymysql

# Connect to database
conn = pymysql.connect(
    host='common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com',
    user='nsjao4ka93qod',
    password='$Y)8v*<j!g3[truG*is|[-9t8N9]',
    database='customer_success_db'
)

cursor = conn.cursor()
cursor.execute('TRUNCATE TABLE backup_history')
conn.commit()
print("Table truncated.")
conn.close()
