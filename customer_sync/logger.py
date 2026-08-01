import logging
import os
import sys

def setup_logger() -> logging.Logger:
    """
    Sets up the logger with custom formatting to match the project requirements.
    Logs to both console and a file inside the 'logs' directory.
    """
    os.makedirs('logs', exist_ok=True)
    
    logger = logging.getLogger("CustomerSync")
    
    # Only configure if handlers haven't been added yet
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # We want the console to just print the exact message without default formatting
        console_formatter = logging.Formatter('%(message)s')
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(console_formatter)
        
        # File handler can have timestamps for better debugging later
        file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        file_handler = logging.FileHandler('logs/sync.log', encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(file_formatter)
        
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        
    return logger

logger = setup_logger()
