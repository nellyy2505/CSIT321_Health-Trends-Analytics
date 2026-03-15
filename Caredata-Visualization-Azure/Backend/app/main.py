from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, health_scan, mydata, upload_csv

app = FastAPI(title="CareData Backend (Azure)")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://d2vw6ry5du4tco.cloudfront.net",
    "https://care-data-portal.netlify.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health_scan.router)
app.include_router(mydata.router)
app.include_router(upload_csv.router)


@app.get("/")
def read_root():
    return {"message": "API is running"}


