
import asyncio
from sqlalchemy import text
from backend.database import engine

async def add_column():
    async with engine.begin() as conn:
        print("Añadiendo columna 'esta_activo' a la tabla 'lobs'...")
        try:
            await conn.execute(text("ALTER TABLE lobs ADD COLUMN esta_activo BOOLEAN DEFAULT TRUE;"))
            print("Columna añadida con éxito.")
        except Exception as e:
            if "already exists" in str(e):
                print("La columna 'esta_activo' ya existe.")
            else:
                print(f"Error al añadir columna: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
