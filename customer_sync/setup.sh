#!/bin/bash

# setup.sh
# Automated Setup and Deployment Script for Customer Sync ETL Pipeline on Ubuntu

set -e

echo "============================================="
echo "   Customer Sync ETL Setup - Ubuntu Server   "
echo "============================================="
echo ""

# 1. Install System Dependencies
echo "[1/6] Installing system dependencies (Python3, venv, pip)..."
sudo apt update -y
sudo apt install python3 python3-venv python3-pip -y

# 2. Setup Virtual Environment
echo "[2/6] Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# 3. Install Python Packages
echo "[3/6] Installing Python dependencies..."
pip install -r requirements.txt

# 4. Configure Environment Variables (.env)
echo "[4/6] Configuring Database and Google Sheets Credentials..."

if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# We have the DB credentials from earlier, but need Spreadsheet ID and Table Name
echo ""
echo "Please enter the missing configuration details:"

read -p "Google Spreadsheet ID: " SPREADSHEET_ID
read -p "Database Table Name: " DB_TABLE
read -p "Absolute Path to Google JSON Credentials (e.g., /opt/customer_sync/credentials.json): " CRED_PATH

# Overwrite the .env file with the user's inputs and known DB credentials
cat <<EOT > .env
# Google Sheets Settings
GOOGLE_APPLICATION_CREDENTIALS=$CRED_PATH
SOURCE_SPREADSHEET_ID=$SPREADSHEET_ID
BACKUP_SHEET_NAME=Backup
RENEWAL_SHEET_NAME=Renewal Transactions

# Database Settings
DB_TYPE=mysql+pymysql
DB_HOST=common-db.ct40ggoqst1b.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_NAME=common-db
DB_USER=nsjao4ka93qod
DB_PASSWORD=\$Y)8v*<j!g3[truG*is|[-9t8N9]
DB_TABLE=$DB_TABLE
EOT

echo ".env file generated successfully."

# 5. Cron Job Setup
echo "[5/6] Setting up daily automated Cron Job (Runs at 2:00 AM daily)..."

CURRENT_DIR=$(pwd)
CRON_JOB="0 2 * * * cd $CURRENT_DIR && $CURRENT_DIR/venv/bin/python main.py >> $CURRENT_DIR/sync.log 2>&1"

# Check if cron job already exists to prevent duplicates
if crontab -l 2>/dev/null | grep -q "customer_sync"; then
    echo "Cron job already exists. Skipping."
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Cron job added successfully."
fi

# 6. Initial Run
echo "[6/6] Setup Complete!"
echo ""
read -p "Do you want to run the first data synchronization now? (y/n): " RUN_NOW

if [[ "$RUN_NOW" =~ ^[Yy]$ ]]; then
    echo "Starting pipeline..."
    python main.py
else
    echo "Skipping initial run. The pipeline will run automatically at 2:00 AM."
    echo "You can manually run it anytime using: source venv/bin/activate && python main.py"
fi
