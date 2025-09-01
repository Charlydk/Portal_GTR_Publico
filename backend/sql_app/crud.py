# /sql_app/crud.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from . import models

# Esta es la función que vamos a mover aquí
async def get_analista_by_email(email: str, db: AsyncSession) -> Optional[models.Analista]:
    result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
    return result.scalars().first()

# En el futuro, otras funciones como 'get_campana_by_id', 'create_tarea', etc., podrían ir aquí.