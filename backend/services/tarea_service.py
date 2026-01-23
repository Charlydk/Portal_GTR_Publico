from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, or_
from sqlalchemy.orm import selectinload
from datetime import datetime
from ..sql_app import models
from ..enums import ProgresoTarea, UserRole

class TareaService:
    @staticmethod
    async def limpiar_tareas_vencidas(db: AsyncSession = None):
        """
        Cierra automáticamente las tareas que ya vencieron y siguen pendientes.
        Si no se provee una sesión, crea una nueva (útil para BackgroundTasks).
        """
        if db is None:
            from ..database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await TareaService._ejecutar_limpieza(session)
        else:
            await TareaService._ejecutar_limpieza(db)

    @staticmethod
    async def _ejecutar_limpieza(db: AsyncSession):
        now = datetime.now()
        query_limpieza = (
            update(models.Tarea)
            .where(
                models.Tarea.fecha_vencimiento < now,
                models.Tarea.progreso.in_([ProgresoTarea.PENDIENTE, ProgresoTarea.EN_PROGRESO])
            )
            .values(progreso=ProgresoTarea.CANCELADA)
            .execution_options(synchronize_session=False)
        )
        await db.execute(query_limpieza)
        await db.commit()

    @staticmethod
    async def get_tareas_globales(db: AsyncSession, skip: int = 0, limit: int = 100, estado=None):
        query = select(models.Tarea).options(
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados),
            selectinload(models.Tarea.comentarios)
        )
        if estado:
            query = query.filter(models.Tarea.progreso == estado)
        query = query.order_by(models.Tarea.fecha_vencimiento.asc(), models.Tarea.fecha_creacion.desc())
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_tareas_analista(db: AsyncSession, analista: models.Analista, skip: int = 0, limit: int = 100, estado=None):
        query = select(models.Tarea).options(
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista),
            selectinload(models.Tarea.comentarios).selectinload(models.ComentarioTarea.autor)
        )

        if analista.role == UserRole.ANALISTA:
            # 1. Campañas donde está asignado fijo (Necesitamos cargar esto si no lo está)
            # Como usamos la dependencia ligera, analista.campanas_asignadas no estará cargada.
            # Mejor hacemos un query para obtener los IDs de campaña.

            from ..sql_app.models import analistas_campanas, SesionCampana

            # IDs de campañas asignadas fijas
            q_asignadas = select(analistas_campanas.c.campana_id).where(analistas_campanas.c.analista_id == analista.id)
            res_asignadas = await db.execute(q_asignadas)
            ids_asignadas = res_asignadas.scalars().all()

            # IDs de campañas con sesión activa
            q_sesiones = select(SesionCampana.campana_id).filter(
                SesionCampana.analista_id == analista.id,
                SesionCampana.fecha_fin.is_(None)
            )
            res_sesiones = await db.execute(q_sesiones)
            ids_sesiones = res_sesiones.scalars().all()

            ids_totales = list(set(ids_asignadas + ids_sesiones))

            query = query.filter(
                or_(
                    models.Tarea.analista_id == analista.id,
                    models.Tarea.campana_id.in_(ids_totales),
                    models.Tarea.campana_id.is_(None)
                )
            )

        if estado:
            query = query.filter(models.Tarea.progreso == estado)

        query = query.order_by(models.Tarea.fecha_vencimiento.asc())
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()
