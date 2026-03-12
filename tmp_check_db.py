import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import inspect
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def check_schema():
    if not DATABASE_URL:
        print("Error: DATABASE_URL no encontrada")
        return
    
    engine = create_async_engine(DATABASE_URL)
    try:
        async with engine.connect() as conn:
            def get_columns(connection):
                res = inspect(connection)
                return res.get_columns("plantillas_checklist_items")
            
            columns = await conn.run_sync(get_columns)
            print("--- Columnas en plantillas_checklist_items ---")
            for col in columns:
                print(f"Col: {col['name']}")
    except Exception as e:
        print(f"Error al conectar o inspeccionar: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_schema())
