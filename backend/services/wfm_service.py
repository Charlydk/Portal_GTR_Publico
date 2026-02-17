from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date
from ..sql_app import models
from ..schemas import models as schemas

class WFMService:
    @staticmethod
    async def get_equipos(db: AsyncSession) -> List[models.Equipo]:
        result = await db.execute(select(models.Equipo))
        return result.scalars().all()

    @staticmethod
    async def get_clusters(db: AsyncSession) -> List[models.Cluster]:
        result = await db.execute(select(models.Cluster))
        return result.scalars().all()

    @staticmethod
    async def get_conceptos(db: AsyncSession) -> List[models.ConceptoTurno]:
        result = await db.execute(select(models.ConceptoTurno))
        return result.scalars().all()

    @staticmethod
    async def get_planificacion(
        db: AsyncSession,
        fecha_inicio: date,
        fecha_fin: date,
        equipo_id: Optional[int] = None
    ) -> List[models.PlanificacionDiaria]:
        query = (
            select(models.PlanificacionDiaria)
            .options(
                selectinload(models.PlanificacionDiaria.analista),
                selectinload(models.PlanificacionDiaria.concepto),
                selectinload(models.PlanificacionDiaria.cluster)
            )
            .where(
                models.PlanificacionDiaria.fecha >= fecha_inicio,
                models.PlanificacionDiaria.fecha <= fecha_fin
            )
        )

        if equipo_id:
            query = query.join(models.Analista).where(models.Analista.equipo_id == equipo_id)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def upsert_turno(
        db: AsyncSession,
        turno_data: schemas.PlanificacionCreate,
        user_id: int
    ) -> models.PlanificacionDiaria:
        query = select(models.PlanificacionDiaria).where(
            models.PlanificacionDiaria.analista_id == turno_data.analista_id,
            models.PlanificacionDiaria.fecha == turno_data.fecha
        )
        result = await db.execute(query)
        db_turno = result.scalars().first()

        if db_turno:
            for key, value in turno_data.model_dump().items():
                setattr(db_turno, key, value)
        else:
            db_turno = models.PlanificacionDiaria(**turno_data.model_dump())
            db_turno.creado_por_id = user_id
            db.add(db_turno)

        await db.commit()

        # Return with relations
        result = await db.execute(
            select(models.PlanificacionDiaria)
            .options(
                selectinload(models.PlanificacionDiaria.analista),
                selectinload(models.PlanificacionDiaria.concepto),
                selectinload(models.PlanificacionDiaria.cluster)
            )
            .where(models.PlanificacionDiaria.id == db_turno.id)
        )
        return result.scalars().first()

    @staticmethod
    async def bulk_upsert_planificaciones(
        db: AsyncSession,
        planificaciones: List[schemas.PlanificacionCreate],
        user_id: int
    ) -> dict:
        """
        Guarda o actualiza múltiples planificaciones en una sola transacción.
        Optimizado para evitar múltiples consultas a la base de datos.
        """
        if not planificaciones:
            return {"created": 0, "updated": 0}

        # 1. Recolectar criterios de búsqueda para traer existentes en un solo lote
        analista_ids = list(set(p.analista_id for p in planificaciones))
        fechas = list(set(p.fecha for p in planificaciones))

        query = select(models.PlanificacionDiaria).where(
            models.PlanificacionDiaria.analista_id.in_(analista_ids),
            models.PlanificacionDiaria.fecha.in_(fechas)
        )
        res = await db.execute(query)
        existentes = res.scalars().all()

        # Mapa para búsqueda rápida: {(analista_id, fecha): objeto_db}
        mapa_existentes = {(e.analista_id, e.fecha): e for e in existentes}

        count_created = 0
        count_updated = 0

        # 2. Procesar cada planificación
        for p_data in planificaciones:
            clave = (p_data.analista_id, p_data.fecha)
            db_p = mapa_existentes.get(clave)

            if db_p:
                # Actualizar existente
                for key, value in p_data.model_dump().items():
                    setattr(db_p, key, value)
                count_updated += 1
            else:
                # Crear nuevo
                db_p = models.PlanificacionDiaria(**p_data.model_dump())
                db_p.creado_por_id = user_id
                db.add(db_p)
                count_created += 1

        await db.commit()
        return {"created": count_created, "updated": count_updated}
