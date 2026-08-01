from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import select, insert
from config import Config
from logger import logger

class DatabaseClient:
    def __init__(self):
        try:
            self.engine = create_engine(Config.get_database_uri(), pool_pre_ping=True)
            self.Session = sessionmaker(bind=self.engine)
            self.metadata = MetaData()
            
            # Reflect only the target table
            self.metadata.reflect(bind=self.engine, only=[Config.DB_TABLE])
            self.table = self.metadata.tables[Config.DB_TABLE]
            
            logger.info("Successfully connected to the database and reflected table schema.")
        except Exception as e:
            logger.error(f"Failed to connect to the database or reflect table: {e}")
            raise

    def fetch_all_records(self) -> set:
        """
        Fetches all records from the target table to identify exact duplicates.
        Returns a set of tuples representing existing rows.
        """
        logger.info("Fetching existing database records for duplicate detection...")
        existing_records = set()
        try:
            with self.Session() as session:
                # We need to fetch specific columns to match the output schema precisely.
                # Assuming the table columns match the output dictionary keys (using snake_case or similar).
                # Since we don't know the exact column names in the DB schema, we will dynamically map them 
                # based on the expected columns if possible, but the prompt says:
                # "Generate records using exactly these columns: Partner, Customer Name, Customer ID, Backup Storage (GB), Activation Date, Status, Renewal Date, Size Increased"
                # If the DB has exactly these column names (perhaps with spaces/parentheses), we can fetch them.
                
                # Fetch all rows
                stmt = select(self.table)
                result = session.execute(stmt)
                
                for row in result:
                    # Convert row to a normalized tuple for fast hashing and comparison.
                    # Stringify everything to handle type mismatches (e.g., Dates vs strings).
                    # Treat None and "" as equivalent for comparison if needed, but exact match is safer.
                    row_dict = row._mapping
                    
                    # We dynamically extract fields based on keys to create a tuple.
                    # We map DB column names based on the 8 expected fields.
                    # We assume the DB columns are exactly named as the required output, or close to it.
                    # If they are different, we might have an issue, but we'll use exact names as per prompt.
                    
                    # We will construct a hashable tuple
                    record_tuple = (
                        str(row_dict.get("Partner", "")),
                        str(row_dict.get("Customer Name", "")),
                        str(row_dict.get("Customer ID", "")),
                        str(row_dict.get("Backup Storage (GB)", "")),
                        str(row_dict.get("Activation Date", "")),
                        str(row_dict.get("Status", "")),
                        str(row_dict.get("Renewal Date", "")),
                        str(row_dict.get("Size Increased", ""))
                    )
                    existing_records.add(record_tuple)
                    
            logger.info(f"Fetched {len(existing_records)} existing records.")
            return existing_records
        except Exception as e:
            logger.error(f"Error fetching existing records: {e}")
            raise

    def insert_new_records(self, records: list[dict]):
        """
        Filters out exact duplicates and inserts the new records.
        """
        existing_records = self.fetch_all_records()
        
        new_records = []
        skipped_count = 0
        
        for record in records:
            # Construct comparison tuple
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
            
            if record_tuple in existing_records:
                skipped_count += 1
            else:
                new_records.append(record)
                # Add to existing to prevent duplicates within the same batch
                existing_records.add(record_tuple)

        logger.info(f"Identified {skipped_count} exact duplicates to skip.")
        logger.info(f"Identified {len(new_records)} new/changed records to insert.")

        if not new_records:
            logger.info("No new records to insert.")
            return 0, skipped_count

        # Batch insert new records
        try:
            with self.Session() as session:
                stmt = insert(self.table).values(new_records)
                session.execute(stmt)
                session.commit()
                logger.info(f"Successfully inserted {len(new_records)} records.")
                return len(new_records), skipped_count
        except Exception as e:
            logger.error(f"Failed to insert records: {e}")
            # The context manager automatically rolls back on exception
            raise
