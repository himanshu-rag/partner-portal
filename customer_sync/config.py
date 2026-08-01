import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Google Sheets settings
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    SOURCE_SPREADSHEET_ID = os.getenv("SOURCE_SPREADSHEET_ID")
    BACKUP_SHEET_NAME = os.getenv("BACKUP_SHEET_NAME", "Backup")
    RENEWAL_SHEET_NAME = os.getenv("RENEWAL_SHEET_NAME", "Renewal Transactions")

    # Database settings
    DB_TYPE = os.getenv("DB_TYPE", "mysql+pymysql")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_TABLE = os.getenv("DB_TABLE")

    @classmethod
    def validate(cls):
        """Validate that all required configuration variables are set."""
        required = [
            "GOOGLE_APPLICATION_CREDENTIALS",
            "SOURCE_SPREADSHEET_ID",
            "DB_HOST",
            "DB_NAME",
            "DB_USER",
            "DB_PASSWORD",
            "DB_TABLE"
        ]
        missing = [var for var in required if not getattr(cls, var)]
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    @classmethod
    def get_database_uri(cls):
        """Generate the SQLAlchemy database URI based on settings."""
        # Using URL encoding for the password just in case it contains special characters
        from urllib.parse import quote_plus
        password = quote_plus(cls.DB_PASSWORD) if cls.DB_PASSWORD else ""
        
        uri = f"{cls.DB_TYPE}://{cls.DB_USER}:{password}@{cls.DB_HOST}:{cls.DB_PORT}/{cls.DB_NAME}"
        return uri
