# /sql_app/crud.py

from sqlalchemy.orm import selectinload
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from . import models

# Esta es la función que vamos a mover aquí
async def get_analista_by_email(email: str, db: AsyncSession) -> Optional[models.Analista]:
    result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
    return result.scalars().first()


async def get_campanas(db: AsyncSession, skip: int = 0, limit: int = 100):
    print("--- ¡EJECUTANDO LA VERSIÓN UNIFICADA Y CORRECTA DE get_campanas! ---") 
    
    query = (
        select(models.Campana)
        .options(
            # Añadimos TODAS las relaciones necesarias aquí
            selectinload(models.Campana.lobs), # La que faltaba en el router
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            # Incluimos las cargas anidadas también
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias).selectinload(models.Incidencia.asignado_a)
        )
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    # Usamos .unique() para evitar duplicados si alguna relación causa un JOIN
    return result.scalars().unique().all()