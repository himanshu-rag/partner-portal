from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from models import Customer
from config import Config
from utils import parse_date, parse_storage
import logging
from datetime import date

logger = logging.getLogger("CustomerSync")

class GoogleSheetsClient:
    """
    Connects to Google Sheets API and fetches formatted spreadsheet data.
    """
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

    def __init__(self):
        try:
            creds = Credentials.from_service_account_file(
                Config.GOOGLE_SERVICE_ACCOUNT, scopes=self.SCOPES)
            self.service = build('sheets', 'v4', credentials=creds)
        except FileNotFoundError:
            raise FileNotFoundError(f"Service account file '{Config.GOOGLE_SERVICE_ACCOUNT}' not found.")
            
        self.sheet_id = Config.GOOGLE_SHEET_ID
        self.sheet_name = Config.GOOGLE_SHEET_NAME

    def fetch_customers(self) -> list[Customer]:
        """
        Fetches row data including cell formatting (strikethrough) from the configured sheet.
        """
        # Request specific fields to minimize payload and extract text formatting
        fields = "sheets(properties/title,data(rowData(values(formattedValue,effectiveFormat/textFormat/strikethrough,textFormatRuns/format/strikethrough))))"
        request = self.service.spreadsheets().get(
            spreadsheetId=self.sheet_id,
            ranges=[self.sheet_name],
            fields=fields
        )
        response = request.execute()
        
        sheets = response.get('sheets', [])
        if not sheets:
            logger.error(f"Sheet '{self.sheet_name}' not found or empty.")
            return []
            
        grid_data = sheets[0].get('data', [])
        if not grid_data:
            return []
            
        row_data = grid_data[0].get('rowData', [])
        if not row_data:
            return []
            
        # Parse headers to dynamically find column indices
        headers = []
        header_row = row_data[0].get('values', [])
        for cell in header_row:
            headers.append(cell.get('formattedValue', '').strip())
            
        try:
            name_idx = headers.index('Customer Name')
            date_idx = headers.index('Activation Date')
            storage_idx = headers.index('Backup Storage (GB)')
        except ValueError as e:
            logger.error(f"Missing required columns in {self.sheet_name}: {e}")
            return []

        customers = []
        # Parse rows (skip header at index 0)
        for i in range(1, len(row_data)):
            values = row_data[i].get('values', [])
            
            # Ensure row has enough columns
            if not values or len(values) <= max(name_idx, date_idx, storage_idx):
                continue
                
            name_cell = values[name_idx]
            name = name_cell.get('formattedValue', '').strip()
            
            if not name:
                continue # Business Rule: Ignore empty customer names
                
            date_str = values[date_idx].get('formattedValue', '')
            storage_str = values[storage_idx].get('formattedValue', '')
            
            # Handle invalid dates gracefully (fallback to a dummy date)
            parsed_date = parse_date(date_str) or date(1970, 1, 1)
            storage = parse_storage(storage_str)
            
            # Determine status based on strikethrough formatting
            strikethrough = False
            effective_format = name_cell.get('effectiveFormat', {}).get('textFormat', {})
            
            if effective_format.get('strikethrough'):
                strikethrough = True
            else:
                # Fallback to check partial formatting runs
                runs = name_cell.get('textFormatRuns', [])
                for run in runs:
                    if run.get('format', {}).get('strikethrough'):
                        strikethrough = True
                        break
                        
            status = "Lost" if strikethrough else "Won"
            
            customers.append(Customer(
                customer_name=name,
                activation_date=parsed_date,
                status=status,
                storage_gb=storage
            ))
            
        return customers
