import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, MetaData, Table, select
from dotenv import load_dotenv
from urllib.parse import quote_plus
import uvicorn

# Load Environment Variables
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_TABLE = os.getenv("DB_TABLE", "backup_history")

if not all([DB_HOST, DB_NAME, DB_USER, DB_PASS]):
    raise RuntimeError("Missing critical database environment variables.")

# Setup SQLAlchemy
password_quoted = quote_plus(DB_PASS)
DB_URI = f"mysql+pymysql://{DB_USER}:{password_quoted}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DB_URI, pool_pre_ping=True)
metadata = MetaData()
backup_table = Table(DB_TABLE, metadata, autoload_with=engine)
storage_size_table = Table("storage_size", metadata, autoload_with=engine)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verify DB Connection
    try:
        with engine.connect() as conn:
            pass
        print("Database connected successfully.")
    except Exception as e:
        print(f"Failed to connect to database: {e}")
    yield
    # Shutdown logic if any

app = FastAPI(title="Partner Portal API", lifespan=lifespan)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Pydantic Models
class LoginRequest(BaseModel):
    email: str

@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")

@app.get("/dashboard")
async def serve_dashboard():
    return FileResponse("static/dashboard.html")

@app.post("/api/login")
async def login(req: LoginRequest):
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    try:
        # Check if the email exists in the database
        with engine.connect() as conn:
            # We map to 'partner_email'
            query = select(backup_table.c.partner_email).where(backup_table.c.partner_email == email).limit(1)
            result = conn.execute(query).fetchone()
            
            if result:
                return {"status": "success", "message": "Login successful", "email": email}
            else:
                raise HTTPException(status_code=401, detail="Email not found or no data available for this partner.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred.")

@app.get("/api/data")
async def get_dashboard_data(email: str):
    email = email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email parameter missing")
        
    try:
        with engine.connect() as conn:
            query = select(backup_table).where(backup_table.c.partner_email == email)
            result = conn.execute(query).fetchall()
            
            import re
            
            # Format results
            data = []
            for row in result:
                partner_name = str(row._mapping.get("partner", ""))
                
                # If partner name contains any bracket, do not show this row to the user
                if re.search(r'[\[\]\(\)\{\}]', partner_name):
                    continue
                    
                data.append({
                    "customer_name": row._mapping.get("customer_name"),
                    "customer_id": row._mapping.get("customer_id"),
                    "backup_storage_gb": str(row._mapping.get("backup_storage_gb")) if row._mapping.get("backup_storage_gb") is not None else None,
                    "activation_date": str(row._mapping.get("activation_date")) if row._mapping.get("activation_date") is not None else None,
                    "status": row._mapping.get("status"),
                    "renewal_date": str(row._mapping.get("renewal_date")) if row._mapping.get("renewal_date") is not None else None,
                    "size_increased": row._mapping.get("size_increased")
                })
                
            # Fetch allocated storage
            allocated_storage = None
            storage_query = select(storage_size_table).where(storage_size_table.c.email == email)
            storage_result = conn.execute(storage_query).fetchone()
            if storage_result:
                allocated_storage = storage_result._mapping.get("item")

            return {"status": "success", "data": data, "allocated_storage": allocated_storage}
    except Exception as e:
        print(f"Data fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve data.")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
