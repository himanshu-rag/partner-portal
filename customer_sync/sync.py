import time
from config import Config
from sheets import GoogleSheetsClient
from transformer import DataTransformer
from database import DatabaseClient
from logger import logger

class SyncJob:
    def __init__(self):
        self.sheets_client = None
        self.transformer = None
        self.db_client = None

    def initialize(self):
        """Initializes all clients."""
        logger.info("Initializing services...")
        self.sheets_client = GoogleSheetsClient()
        self.transformer = DataTransformer()
        self.db_client = DatabaseClient()

    def run(self):
        """Executes the full ETL pipeline."""
        start_time = time.time()
        logger.info("=" * 60)
        logger.info("STARTING CUSTOMER SYNC ETL PIPELINE")
        logger.info("=" * 60)

        inserted_count = 0
        skipped_count = 0
        customers_processed = 0
        renewals_processed = 0

        try:
            # 1. Validate Config
            Config.validate()

            # 2. Initialize
            self.initialize()

            # 3. Extract (Google Sheets)
            backup_df = self.sheets_client.fetch_worksheet_data(Config.BACKUP_SHEET_NAME)
            renewal_df = self.sheets_client.fetch_worksheet_data(Config.RENEWAL_SHEET_NAME)
            
            customers_processed = len(backup_df)
            renewals_processed = len(renewal_df)

            # 4. Transform (Business Logic)
            final_records = self.transformer.transform(backup_df, renewal_df)

            # 5. Load (Database)
            inserted_count, skipped_count = self.db_client.insert_new_records(final_records)

        except Exception as e:
            logger.error(f"ETL Pipeline Failed: {e}")
        
        finally:
            end_time = time.time()
            duration = end_time - start_time
            
            logger.info("=" * 60)
            logger.info("PIPELINE EXECUTION SUMMARY")
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info(f"Customers Processed (Backup rows): {customers_processed}")
            logger.info(f"Renewals Processed (Renewal rows): {renewals_processed}")
            logger.info(f"Records Inserted (New/Changed): {inserted_count}")
            logger.info(f"Records Skipped (Exact Duplicates): {skipped_count}")
            logger.info("=" * 60)

if __name__ == "__main__":
    job = SyncJob()
    job.run()
