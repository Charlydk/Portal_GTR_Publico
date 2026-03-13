import asyncio
from datetime import date
from sqlalchemy import select
from backend.database import AsyncSessionLocal
from backend.sql_app import models

async def test():
    async with AsyncSessionLocal() as session:
        # Verificar que podemos consultar tareas
        res = await session.execute(select(models.Tarea).limit(1))
        print(f"Tareas encontradas: {res.scalars().first() is not None}")

if __name__ == "__main__":
    asyncio.run(test())
