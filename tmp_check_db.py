import asyncio
from sqlalchemy import text
from backend.database import engine

async def check_columns():
    async with engine.connect() as conn:
        try:
            res = await conn.execute(text("SELECT * FROM catalogo_tareas_reporteria LIMIT 1"))
            print(f"Columnas encontradas: {res.keys()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_columns())
