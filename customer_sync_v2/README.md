# Customer Sync ETL Pipeline (V2 Modular)

This is a production-ready, modular Python ETL application that synchronizes data from Google Sheets (`Backup`, `Renewal Transactions`, `Portal`) into your AWS MySQL Database.

## Features
- **Dynamic Header Detection:** Safely extracts data from Google Sheets without relying on hardcoded columns.
- **Portal Lookup:** Automatically joins `Partner` names with their corresponding `Partner Email` using case-insensitive and whitespace-ignorant matching.
- **Robust Schema Protection:** Protects your MySQL strict schema by securely catching invalid decimals and dates to prevent infinite duplication loops.
- **One-to-Many Relational Joins:** Properly links multiple renewal transactions to the correct backup customer without losing data.
- **Secure Transactional Sync:** Validates 9 distinct column fields for EXACT duplicates. Appends only new data. Implements strict `COMMIT` and `ROLLBACK` for safe DB writes.

## Setup Instructions

### 1. Environment Variables
Create a `.env` file in this directory based on the `.env.example`:
```bash
cp .env.example .env
```
Fill in the `.env` file with your precise database credentials.

### 2. Google Credentials
Place your `credentials.json` (Google Service Account key) in this directory.

### 3. Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the Pipeline
```bash
python main.py
```
