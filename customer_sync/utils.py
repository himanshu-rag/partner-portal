from datetime import datetime, date
import re
from typing import Optional

def parse_date(date_str: str) -> Optional[date]:
    """
    Parses a date string into a datetime.date object.
    Supports multiple date formats, primarily focusing on dd-mm-yyyy.
    Gracefully handles invalid dates by returning None.
    """
    if not date_str:
        return None
        
    date_str = str(date_str).strip()
    
    # Try different formats, starting with the requested DD-MM-YYYY
    formats_to_try = (
        '%d-%m-%Y', 
        '%Y-%m-%d', 
        '%d/%m/%Y', 
        '%m/%d/%Y',
        '%Y/%m/%d'
    )
    
    for fmt in formats_to_try:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
            
    return None

def parse_storage(storage_val) -> int:
    """
    Parses storage value into an integer.
    Defaults to 0 if empty or invalid.
    """
    if not storage_val:
        return 0
        
    try:
        # Strip all non-numeric characters (except minus sign if it exists)
        clean_str = re.sub(r'[^\d]', '', str(storage_val))
        if not clean_str:
            return 0
        return int(clean_str)
    except Exception:
        return 0
