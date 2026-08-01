import pandas as pd
from logger import logger

class DataTransformer:
    def __init__(self):
        pass

    def _normalize_string(self, value):
        """Helper to normalize strings: ignore case, leading/trailing/multiple spaces."""
        if pd.isna(value):
            return ""
        # Convert to string, strip whitespace, lowercase, and collapse multiple spaces
        return ' '.join(str(value).strip().lower().split())

    def transform(self, backup_df: pd.DataFrame, renewal_df: pd.DataFrame) -> list[dict]:
        """
        Transforms the backup and renewal dataframes according to the business rules.
        """
        logger.info("Starting data transformation...")
        
        # Define expected columns for robustness
        # Backup
        partner_col = "Partner"
        customer_name_col = "Customer Name"
        customer_id_col = "Customer ID"
        storage_col = "Backup Storage (GB)"
        backup_activation_col = "Activation Date"
        
        # Renewal
        renewal_status_col = "Status"
        renewal_activation_col = "Activation Date"
        renewal_item_col = "Item"

        # Check required columns in backup
        required_backup = [partner_col, customer_name_col, customer_id_col, storage_col, backup_activation_col]
        for col in required_backup:
            if col not in backup_df.columns:
                logger.warning(f"Expected column '{col}' missing from Backup sheet. Available: {list(backup_df.columns)}")

        # Check required columns in renewal
        if not renewal_df.empty:
            required_renewal = [customer_id_col, customer_name_col, renewal_status_col, renewal_activation_col, renewal_item_col]
            for col in required_renewal:
                if col not in renewal_df.columns:
                    logger.warning(f"Expected column '{col}' missing from Renewal sheet. Available: {list(renewal_df.columns)}")

        final_records = []
        
        # Pre-process Renewal DF for faster matching
        renewal_records = []
        if not renewal_df.empty:
            for _, row in renewal_df.iterrows():
                renewal_records.append({
                    'id': self._normalize_string(row.get(customer_id_col)),
                    'name': self._normalize_string(row.get(customer_name_col)),
                    'status': row.get(renewal_status_col),
                    'renewal_date': row.get(renewal_activation_col),
                    'size_increased': row.get(renewal_item_col)
                })

        for _, backup_row in backup_df.iterrows():
            # Skip empty rows (where Partner, Customer Name, ID are all missing)
            if pd.isna(backup_row.get(partner_col)) and pd.isna(backup_row.get(customer_name_col)) and pd.isna(backup_row.get(customer_id_col)):
                continue

            partner = backup_row.get(partner_col)
            customer_name = backup_row.get(customer_name_col)
            customer_id = backup_row.get(customer_id_col)
            backup_storage = backup_row.get(storage_col)
            activation_date = backup_row.get(backup_activation_col)

            norm_id = self._normalize_string(customer_id)
            norm_name = self._normalize_string(customer_name)

            # Match renewals
            matched_renewals = []
            for r in renewal_records:
                if norm_id and r['id'] == norm_id:
                    matched_renewals.append(r)
                elif norm_name and r['name'] == norm_name:
                    matched_renewals.append(r)

            if matched_renewals:
                for renewal in matched_renewals:
                    final_records.append({
                        "Partner": partner,
                        "Customer Name": customer_name,
                        "Customer ID": customer_id,
                        "Backup Storage (GB)": backup_storage,
                        "Activation Date": activation_date,
                        "Status": renewal['status'],
                        "Renewal Date": renewal['renewal_date'],
                        "Size Increased": renewal['size_increased']
                    })
            else:
                # No renewal transaction
                final_records.append({
                    "Partner": partner,
                    "Customer Name": customer_name,
                    "Customer ID": customer_id,
                    "Backup Storage (GB)": backup_storage,
                    "Activation Date": activation_date,
                    "Status": None,
                    "Renewal Date": None,
                    "Size Increased": None
                })

        logger.info(f"Transformation complete. Generated {len(final_records)} records.")
        return final_records
