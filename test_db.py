from backend.sql_app.database import SessionLocal
from backend.sql_app.models import SesionCampana

try:
    db = SessionLocal()
    count = db.query(SesionCampana).count()
    print("DB_STATUS: OK", count)
except Exception as e:
    print("DB_STATUS: ERROR", str(e))
