import pandas as pd
import re
from config import logger

class DataTransformer:
    @staticmethod
    def _normalize_string(val):
        if pd.isna(val) or val is None:
            return None
        # Convert to string, strip leading/trailing, lowercase, and collapse multiple spaces
        val_str = str(val).strip().lower()
        val_str = re.sub(r'\s+', ' ', val_str)
        return val_str if val_str else None

    @staticmethod
    def _normalize_date(date_val):
        if pd.isna(date_val) or str(date_val).strip() == "": return None
        try:
            # Parse DD-MM-YYYY to YYYY-MM-DD for MySQL DATE compatibility
            d = pd.to_datetime(str(date_val).strip(), dayfirst=True)
            return d.strftime("%Y-%m-%d")
        except Exception:
            return None

    @staticmethod
    def _normalize_decimal(dec_val):
        if pd.isna(dec_val) or str(dec_val).strip() == "": return None
        try:
            # Strip extra text like 'GB' or 'TB' just in case
            val_str = str(dec_val).replace("GB", "").replace("TB", "").strip()
            return f"{float(val_str):.2f}"
        except Exception:
            # Return None to prevent invalid strings (like '1 TB +5') from throwing MySQL truncation errors
            return None

    def build_portal_lookup(self, portal_df: pd.DataFrame) -> dict:
        lookup = {}
        if portal_df.empty:
            return lookup
            
        for _, row in portal_df.iterrows():
            partner_norm = self._normalize_string(row.get("Partner"))
            email = str(row.get("Email")).strip() if not pd.isna(row.get("Email")) else None
            if partner_norm and email:
                lookup[partner_norm] = email
        return lookup

    def transform_portal_storage(self, portal_df: pd.DataFrame) -> list:
        logger.info("Transforming portal storage records...")
        records = []
        if portal_df.empty:
            return records
            
        for _, row in portal_df.iterrows():
            partner_name = str(row.get("Partner")).strip() if not pd.isna(row.get("Partner")) else None
            email = str(row.get("Email")).strip() if not pd.isna(row.get("Email")) else None
            item = str(row.get("Item")).strip() if not pd.isna(row.get("Item")) else None
            
            if partner_name or email or item:
                records.append({
                    "partner_name": partner_name,
                    "email": email,
                    "item": item
                })
        return records

    def transform(self, backup_df: pd.DataFrame, renewal_df: pd.DataFrame, portal_df: pd.DataFrame) -> list:
        logger.info("Starting data transformation...")
        
        # 1. Build Master Lookup for Portal
        portal_lookup = self.build_portal_lookup(portal_df)
        
        # 2. Build Renewal Transactions structures
        renewal_records = []
        if not renewal_df.empty:
            for _, row in renewal_df.iterrows():
                renewal_records.append({
                    'id_norm': self._normalize_string(row.get("Customer ID")),
                    'name_norm': self._normalize_string(row.get("Customer Name")),
                    'status': str(row.get("Status")).strip() if not pd.isna(row.get("Status")) else None,
                    'renewal_date': self._normalize_date(row.get("Activation Date")),
                    'size_increased': str(row.get("Item")).strip() if not pd.isna(row.get("Item")) else None
                })

        final_records = []
        
        # 3. Process Backup Sheet
        for _, backup_row in backup_df.iterrows():
            partner = str(backup_row.get("Partner")).strip() if not pd.isna(backup_row.get("Partner")) else None
            customer_name = str(backup_row.get("Customer Name")).strip() if not pd.isna(backup_row.get("Customer Name")) else None
            customer_id = str(backup_row.get("Customer ID")).strip() if not pd.isna(backup_row.get("Customer ID")) else None
            
            # Skip completely empty rows
            if not partner and not customer_name and not customer_id:
                continue

            backup_storage = self._normalize_decimal(backup_row.get("Backup Storage (GB)"))
            activation_date = self._normalize_date(backup_row.get("Activation Date"))
            
            # Look up Partner Email
            partner_norm = self._normalize_string(partner)
            partner_email = portal_lookup.get(partner_norm, None)

            # Match Renewals
            norm_id = self._normalize_string(customer_id)
            norm_name = self._normalize_string(customer_name)
            
            matched_renewals = []
            for r in renewal_records:
                # Priority 1: Customer ID match
                if norm_id and r['id_norm'] == norm_id:
                    matched_renewals.append(r)
                # Priority 2: Customer Name match (only if ID wasn't already matched to prevent double counting?)
                # Requirements state: "search Renewal Transactions. Matching priority 1. Customer ID 2. Customer Name."
                elif not norm_id and norm_name and r['name_norm'] == norm_name:
                    matched_renewals.append(r)
                # Wait, if ID doesn't match but Name does? 
                elif norm_id and r['id_norm'] != norm_id and norm_name and r['name_norm'] == norm_name:
                    # ID exists but doesn't match, Name matches. Should we link it?
                    # "Matching priority 1. Customer ID 2. Customer Name." usually means if ID is present use it, else fallback to Name.
                    # Or if ID is missing in Renewal but Name matches. We will link if Name matches and ID wasn't contradictory.
                    if not r['id_norm']:
                        matched_renewals.append(r)

            if matched_renewals:
                # One distinct record per renewal
                for renewal in matched_renewals:
                    # Enforce strict Status and Size Increased rules
                    raw_status = renewal['status']
                    raw_item = renewal['size_increased']
                    
                    final_status = None
                    final_size_increased = 0
                    
                    if raw_status:
                        status_lower = raw_status.lower()
                        if status_lower == 'won':
                            final_status = 'won'
                            final_size_increased = raw_item if raw_item else 0
                        elif status_lower == 'lost':
                            final_status = 'lost'
                            final_size_increased = 0
                        else:
                            final_status = raw_status
                            final_size_increased = 0
                    else:
                        final_status = None
                        final_size_increased = 0
                    
                    final_records.append({
                        "Partner": partner,
                        "Partner Email": partner_email,
                        "Customer Name": customer_name,
                        "Customer ID": customer_id,
                        "Backup Storage (GB)": backup_storage,
                        "Activation Date": activation_date,
                        "Status": final_status,
                        "Renewal Date": renewal['renewal_date'],
                        "Size Increased": final_size_increased
                    })
            else:
                # No renewals, generate one record with NULLs and 0
                final_records.append({
                    "Partner": partner,
                    "Partner Email": partner_email,
                    "Customer Name": customer_name,
                    "Customer ID": customer_id,
                    "Backup Storage (GB)": backup_storage,
                    "Activation Date": activation_date,
                    "Status": None,
                    "Renewal Date": None,
                    "Size Increased": 0
                })
                
        logger.info(f"Transformation complete. Generated {len(final_records)} records.")
        return final_records
