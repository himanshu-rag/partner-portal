import time
from config import logger, BACKUP_SHEET_NAME, RENEWAL_SHEET_NAME, PORTAL_SHEET_NAME
from google_sheets import GoogleSheetsClient
from transformer import DataTransformer
from database import DatabaseClient

class ETLSyncPipeline:
    def __init__(self):
        self.sheets_client = GoogleSheetsClient()
        self.transformer = DataTransformer()
        self.db_client = DatabaseClient()

    def run(self):
        start_time = time.time()
        logger.info("=" * 60)
        logger.info("STARTING CUSTOMER SYNC ETL PIPELINE (V2)")
        logger.info("=" * 60)

        try:
            # 1. Extract
            backup_df = self.sheets_client.fetch_worksheet_data(BACKUP_SHEET_NAME)
            renewal_df = self.sheets_client.fetch_worksheet_data(RENEWAL_SHEET_NAME)
            portal_df = self.sheets_client.fetch_worksheet_data(PORTAL_SHEET_NAME)

            if backup_df.empty:
                logger.error("Backup sheet is empty. Aborting pipeline.")
                return

            # 2. Transform
            final_records = self.transformer.transform(backup_df, renewal_df, portal_df)
            portal_storage_records = self.transformer.transform_portal_storage(portal_df)

            # 3. Load
            inserted, skipped = self.db_client.insert_records(final_records)
            storage_size_inserted = self.db_client.insert_storage_size_records(portal_storage_records)

            duration = time.time() - start_time
            logger.info("=" * 60)
            logger.info("PIPELINE EXECUTION SUMMARY")
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info(f"Backup Customers Processed: {len(backup_df)}")
            logger.info(f"Total Records Generated: {len(final_records)}")
            logger.info(f"Records Inserted (New/Changed): {inserted}")
            logger.info(f"Records Skipped (Exact Duplicates): {skipped}")
            logger.info(f"Portal Storage Records Inserted: {storage_size_inserted}")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"ETL Pipeline Failed: {e}")
            logger.info("=" * 60)
            logger.info("PIPELINE ABORTED WITH ERRORS")
            logger.info("=" * 60)
