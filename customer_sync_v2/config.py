import os
import sys
from dotenv import load_dotenv
from urllib.parse import quote_plus
from logger import logger

# Load environment variables
load_dotenv()

# Google Sheets Configuration
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")

# Worksheet Names
BACKUP_SHEET_NAME = "Backup"
RENEWAL_SHEET_NAME = "Renewal Transactions"
PORTAL_SHEET_NAME = "Portal"

# Database Configuration
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_TABLE = os.getenv("DB_TABLE", "backup_history")

# Validate critical config
if not all([SPREADSHEET_ID, DB_HOST, DB_NAME, DB_USER, DB_PASS]):
    print("CRITICAL ERROR: Missing essential environment variables. Please check your .env file.")
    sys.exit(1)

def get_db_uri() -> str:
    # Use PyMySQL driver for SQLAlchemy
    password_quoted = quote_plus(DB_PASS)
    return f"mysql+pymysql://{DB_USER}:{password_quoted}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


