import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from config import SPREADSHEET_ID, GOOGLE_CREDENTIALS_PATH, logger

from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

class GoogleSheetsClient:
    def __init__(self):
        try:
            self.scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly']
            self.creds = service_account.Credentials.from_service_account_file(
                GOOGLE_CREDENTIALS_PATH, scopes=self.scopes
            )
            self.service = build('sheets', 'v4', credentials=self.creds, cache_discovery=False)
            logger.info("Google Sheets API authenticated successfully.")
        except Exception as e:
            logger.error(f"Failed to authenticate with Google Sheets: {e}")
            raise

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def fetch_worksheet_data(self, worksheet_name: str) -> pd.DataFrame:
        """
        Dynamically fetches data from a worksheet by detecting headers and dimensions.
        """
        logger.info(f"Fetching data from worksheet: {worksheet_name}")
        try:
            sheet = self.service.spreadsheets()
            result = sheet.values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"'{worksheet_name}'"  # Fetches the entire populated data range automatically
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.warning(f"No data found in worksheet {worksheet_name}.")
                return pd.DataFrame()
            
            # The API might not return trailing empty columns, so we pad them based on the header
            headers = [str(h).strip() for h in values[0]]
            data = values[1:]
            
            cleaned_data = []
            for row in data:
                # Pad rows that are shorter than the header list
                padded_row = row + [None] * (len(headers) - len(row))
                # Truncate rows that are longer than the header list
                padded_row = padded_row[:len(headers)]
                cleaned_data.append(padded_row)
                
            df = pd.DataFrame(cleaned_data, columns=headers)
            logger.info(f"Successfully fetched {len(df)} rows from {worksheet_name}.")
            return df
            
        except HttpError as error:
            if error.resp.status == 400 and 'Unable to parse range' in str(error):
                logger.error(f"Missing worksheet '{worksheet_name}'. Returning empty dataset.")
                return pd.DataFrame()
            logger.error(f"Google Sheets API Error for worksheet '{worksheet_name}': {error}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error fetching '{worksheet_name}': {e}")
            raise
