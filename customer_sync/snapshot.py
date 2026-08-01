import pymysql
import pandas as pd
import matplotlib.pyplot as plt

conn = pymysql.connect(
    host='common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com',
    user='nsjao4ka93qod',
    password='$Y)8v*<j!g3[truG*is|[-9t8N9]',
    database='customer_success_db'
)

# Fetch top 8 rows to display nicely in the image
df = pd.read_sql("SELECT * FROM backup_history LIMIT 8", conn)
conn.close()

# Strip any invisible whitespace from DB column names
df.columns = df.columns.str.strip().str.lower()

# Keep all important columns including size_increased
df = df[['partner', 'customer_name', 'customer_id', 'backup_storage_gb', 'activation_date', 'status', 'renewal_date', 'size_increased']]

# Truncate long strings for better display
df['partner'] = df['partner'].str.slice(0, 15) + '...'
df['customer_name'] = df['customer_name'].str.slice(0, 15) + '...'

# Create a figure and axis
fig, ax = plt.subplots(figsize=(12, 4))
ax.axis('tight')
ax.axis('off')

# Plot table
table = ax.table(cellText=df.values, colLabels=df.columns, loc='center', cellLoc='center')

# Style the table
table.auto_set_font_size(False)
table.set_fontsize(10)
table.scale(1.2, 1.5)

# Color the headers
for (row, col), cell in table.get_celld().items():
    if row == 0:
        cell.set_text_props(weight='bold', color='white')
        cell.set_facecolor('#4CAF50')
    else:
        cell.set_facecolor('#f3f3f3' if row % 2 == 0 else 'white')

plt.title("Actual Data inside customer_success_db -> backup_history", fontsize=14, weight='bold', pad=20)
plt.tight_layout()

# Save the image to the artifact directory so it can be embedded in markdown
plt.savefig('/Users/himanshu_rags/.gemini/antigravity/brain/bc9e4a13-dbf2-42df-b077-f2766efc8364/snapshot.png', dpi=300, bbox_inches='tight')
print("Snapshot saved.")
