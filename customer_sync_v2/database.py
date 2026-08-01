from sqlalchemy import create_engine, MetaData, Table, select
from sqlalchemy.orm import sessionmaker
from config import get_db_uri, DB_TABLE, logger
import sys

class DatabaseClient:
    def __init__(self):
        try:
            self.engine = create_engine(get_db_uri(), pool_pre_ping=True)
            self.metadata = MetaData()
            self.table = Table(DB_TABLE, self.metadata, autoload_with=self.engine)
            self.Session = sessionmaker(bind=self.engine)
            
            # Verify columns
            expected_cols = [
                "partner", "partner_email", "customer_name", "customer_id", 
                "backup_storage_gb", "activation_date", "status", "renewal_date", "size_increased"
            ]
            
            # Map clean strings to actual database column names (to bypass trailing spaces in db schema if any)
            self.col_map = {}
            for col in self.table.columns:
                clean_name = col.name.strip().lower()
                # Find matching expected col
                for expected in expected_cols:
                    if expected.replace("_", "") == clean_name.replace("_", ""):
                        self.col_map[expected] = col.name
            
            # Critical validation
            if "partner_email" not in self.col_map:
                logger.error(f"CRITICAL: Column 'partner_email' not found in table '{DB_TABLE}'. Please run ALTER TABLE.")
                sys.exit(1)
                
            logger.info("Successfully connected to the database and verified schema.")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def get_existing_customer_ids(self) -> set:
        """
        Reads all existing records and returns a set of existing customer IDs.
        """
        logger.info("Fetching existing database records for UPSERT detection...")
        existing_ids = set()
        
        with self.Session() as session:
            result = session.execute(select(self.table))
            for row in result:
                c_id = row._mapping.get(self.col_map.get("customer_id", "customer_id"))
                if c_id:
                    existing_ids.add(str(c_id).strip())
        
        return existing_ids

    def insert_records(self, new_records: list) -> tuple:
        """
        Takes a list of dictionaries. Checks if customer_id exists.
        If it exists, adds to update list. If it does not exist, adds to insert list.
        """
        if not new_records:
            return 0, 0
            
        existing_ids = self.get_existing_customer_ids()
        
        records_to_insert = []
        records_to_update = []
        
        # Track processed IDs in this batch to prevent duplicates inside the batch itself
        processed_ids = set()
        
        for record in new_records:
            c_id = str(record.get("Customer ID", "")).strip()
            
            # Skip records without a Customer ID, or if we already processed this ID in this batch
            if not c_id or c_id in processed_ids or c_id == "None":
                continue
                
            processed_ids.add(c_id)
            
            if c_id in existing_ids:
                records_to_update.append(record)
            else:
                records_to_insert.append(record)
                
        logger.info(f"Identified {len(records_to_update)} records to UPDATE.")
        logger.info(f"Identified {len(records_to_insert)} records to INSERT.")
        
        if not records_to_insert and not records_to_update:
            return 0, 0
            
        import pymysql
        conn = self.engine.raw_connection()
        try:
            cursor = conn.cursor()
            try:
                db_cols = [
                    self.col_map.get("partner", "partner"),
                    self.col_map.get("partner_email", "partner_email"),
                    self.col_map.get("customer_name", "customer_name"),
                    self.col_map.get("customer_id", "customer_id"),
                    self.col_map.get("backup_storage_gb", "backup_storage_gb"),
                    self.col_map.get("activation_date", "activation_date"),
                    self.col_map.get("status", "status"),
                    self.col_map.get("renewal_date", "renewal_date"),
                    self.col_map.get("size_increased", "size_increased")
                ]
                
                # Execute Updates
                if records_to_update:
                    update_set = ", ".join([f"`{c}`=%s" for c in db_cols if c != self.col_map.get("customer_id", "customer_id")])
                    sql_update = f"UPDATE {DB_TABLE} SET {update_set} WHERE `{self.col_map.get('customer_id', 'customer_id')}`=%s"
                    
                    update_values = []
                    for r in records_to_update:
                        update_values.append((
                            r.get("Partner"),
                            r.get("Partner Email"),
                            r.get("Customer Name"),
                            r.get("Backup Storage (GB)"),
                            r.get("Activation Date"),
                            r.get("Status"),
                            r.get("Renewal Date"),
                            r.get("Size Increased"),
                            r.get("Customer ID")
                        ))
                    cursor.executemany(sql_update, update_values)
                
                # Execute Inserts
                if records_to_insert:
                    col_names = ", ".join([f"`{c}`" for c in db_cols])
                    placeholders = ", ".join(["%s"] * len(db_cols))
                    sql_insert = f"INSERT INTO {DB_TABLE} ({col_names}) VALUES ({placeholders})"
                    
                    insert_values = []
                    for r in records_to_insert:
                        insert_values.append((
                            r.get("Partner"),
                            r.get("Partner Email"),
                            r.get("Customer Name"),
                            r.get("Customer ID"),
                            r.get("Backup Storage (GB)"),
                            r.get("Activation Date"),
                            r.get("Status"),
                            r.get("Renewal Date"),
                            r.get("Size Increased")
                        ))
                    cursor.executemany(sql_insert, insert_values)
                
            except Exception as e:
                logger.error(f"SQL Error during UPSERT: {e}")
                raise
            finally:
                cursor.close()
            conn.commit()
        except Exception as e:
            logger.error("Transaction rolled back due to error.")
            conn.rollback()
            raise
        finally:
            conn.close()
            
        return len(records_to_insert) + len(records_to_update), 0

    def insert_storage_size_records(self, records: list) -> int:
        if not records:
            return 0
        
        logger.info(f"Inserting {len(records)} records into storage_size table...")
        
        # Use raw connection for fast bulk operations
        conn = self.engine.raw_connection()
        try:
            cursor = conn.cursor()
            try:
                # Clear existing table to perform full sync
                cursor.execute("TRUNCATE TABLE storage_size")
                
                sql_insert = "INSERT INTO storage_size (partner_name, email, item) VALUES (%s, %s, %s)"
                insert_values = [(r['partner_name'], r['email'], r['item']) for r in records]
                
                if insert_values:
                    cursor.executemany(sql_insert, insert_values)
            except Exception as e:
                logger.error(f"SQL Error during storage_size sync: {e}")
                raise
            finally:
                cursor.close()
            conn.commit()
        except Exception as e:
            logger.error("Transaction rolled back due to error.")
            conn.rollback()
            raise
        finally:
            conn.close()
            
        return len(records)
