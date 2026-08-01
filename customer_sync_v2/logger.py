import logging
import sys

def setup_logger():
    logger = logging.getLogger("ETL_SYNC")
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger

logger = setup_logger()
