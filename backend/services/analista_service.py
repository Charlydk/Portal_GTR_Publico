from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from ..sql_app import models
from typing import Optional

class AnalistaService:
    @staticmethod
    async def get_analista_by_email(db: AsyncSession, email: str):
        result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
        return result.scalars().first()

    @staticmethod
    async def get_analista_full(db: AsyncSession, analista_id: int):
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_id, models.Analista.esta_activo == True)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.equipo),
                selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
                selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
                selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
                selectinload(models.Analista.tareas_generadas_por_avisos).selectinload(models.TareaGeneradaPorAviso.aviso_origen),
                selectinload(models.Analista.incidencias_creadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs)
                ),
                selectinload(models.Analista.incidencias_asignadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs)
                ),
                selectinload(models.Analista.solicitudes_hhee).selectinload(models.SolicitudHHEE.supervisor),
                selectinload(models.Analista.planificaciones).selectinload(models.PlanificacionDiaria.cluster)
            )
        )
        return result.scalars().first()
