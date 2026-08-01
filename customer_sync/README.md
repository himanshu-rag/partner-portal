# Customer Sync ETL Pipeline

This project is a production-ready Python ETL pipeline that synchronizes customer data from Google Sheets into an existing relational database. It is designed to run periodically (e.g., daily) and maintains an append-only historical record of customer data and renewals.

## Architecture

1. **Extract**: Reads data directly from two specific worksheets ("Backup" and "Renewal Transactions") using the Google Sheets API.
2. **Transform**: Normalizes data, matches renewals to customers (via ID or Name), handles one-to-many relationships, and maps fields according to business rules.
3. **Load**: Connects to an existing database, identifies exact duplicates, and inserts only new/changed records to preserve historical state.

## Requirements

- Python 3.9+
- Google Service Account Credentials (`.json` file)
- An existing SQL Database (e.g., MySQL, PostgreSQL)

## Installation

1. Clone the repository.
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your actual Google Sheets ID, credentials path, and database connection details.

## Running the Pipeline

Execute the main script to run a single synchronization pass:

```bash
python main.py
```

## Automation

You can schedule this pipeline to run daily using `cron`:

```bash
0 2 * * * cd /path/to/customer_sync && /path/to/venv/bin/python main.py >> logs/cron.log 2>&1
```
