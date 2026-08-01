import pymysql
conn = pymysql.connect(host='common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com', user='nsjao4ka93qod', password=r'$Y)8v*<j!g3[truG*is|[-9t8N9]', database='customer_success_db')
cursor = conn.cursor()
cursor.execute('SHOW COLUMNS FROM backup_history')
print([row[0] for row in cursor.fetchall()])
conn.close()
