import os
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from config import Config
from logger import logger

class GoogleSheetsClient:
    def __init__(self):
        self.scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']
        self.creds = None
        
        # Determine how to load credentials
        cred_path = Config.GOOGLE_APPLICATION_CREDENTIALS
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Google credentials file not found at {cred_path}")

        try:
            self.creds = service_account.Credentials.from_service_account_file(
                cred_path, scopes=self.scopes
            )
            self.service = build('sheets', 'v4', credentials=self.creds)
            self.sheet = self.service.spreadsheets()
            logger.info("Google Sheets API authenticated successfully.")
        except Exception as e:
            logger.error(f"Failed to authenticate Google Sheets API: {e}")
            raise

    def fetch_worksheet_data(self, worksheet_name: str) -> pd.DataFrame:
        """
        Fetches all data from a specified worksheet and returns a pandas DataFrame.
        Automatically detects the last row and column by reading the entire sheet.
        """
        try:
            logger.info(f"Fetching data from worksheet: {worksheet_name}")
            
            # Fetch entire worksheet values
            result = self.sheet.values().get(
                spreadsheetId=Config.SOURCE_SPREADSHEET_ID,
                range=worksheet_name
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning(f"No data found in worksheet {worksheet_name}")
                return pd.DataFrame()
            
            # The first row contains headers
            headers = values[0]
            data = values[1:]
            
            # Ensure all rows have the same length as headers
            cleaned_data = []
            for row in data:
                # Pad row with Nones if it's shorter than headers
                padded_row = row + [None] * (len(headers) - len(row))
                # Truncate if it's longer than headers
                padded_row = padded_row[:len(headers)]
                cleaned_data.append(padded_row)
                
            df = pd.DataFrame(cleaned_data, columns=headers)
            
            # Clean up column names (strip whitespace)
            df.columns = df.columns.str.strip()
            
            logger.info(f"Successfully fetched {len(df)} rows from {worksheet_name}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data from {worksheet_name}: {e}")
            raise
