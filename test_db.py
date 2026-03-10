import asyncio
import sys

sys.path.append("c:\\Users\\bernardino.20\\Documents\\Proyectos\\Portal_GTR_Publico")

from backend.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT id, titulo, fecha_apertura FROM incidencias ORDER BY id DESC LIMIT 5;"))
        rows = result.fetchall()
        print("Ultimas incidencias en DB:")
        for row in rows:
            print(f"ID: {row[0]}, Titulo: {row[1]}, Fecha: {row[2]}")

if __name__ == "__main__":
    asyncio.run(main())
