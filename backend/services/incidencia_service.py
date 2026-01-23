from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import case
from ..sql_app import models
from ..enums import EstadoIncidencia, GravedadIncidencia

class IncidenciaService:
    @staticmethod
    async def get_incidencias_detalle(db: AsyncSession, incidencia_id: int):
        result = await db.execute(
            select(models.Incidencia)
            .options(
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.actualizaciones).selectinload(models.ActualizacionIncidencia.autor),
                selectinload(models.Incidencia.asignado_a),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.cerrado_por)
            )
            .filter(models.Incidencia.id == incidencia_id)
        )
        return result.scalars().first()

    @staticmethod
    async def get_incidencias_activas_widget(db: AsyncSession):
        from sqlalchemy import func
        from ..sql_app.models import ActualizacionIncidencia

        # Subconsulta para obtener la última actualización
        latest_update_subq = select(
            ActualizacionIncidencia.incidencia_id,
            func.max(ActualizacionIncidencia.id).label('max_id')
        ).group_by(ActualizacionIncidencia.incidencia_id).subquery()

        latest_comment_q = select(
            ActualizacionIncidencia.incidencia_id,
            ActualizacionIncidencia.comentario,
            ActualizacionIncidencia.fecha_actualizacion
        ).join(
            latest_update_subq, ActualizacionIncidencia.id == latest_update_subq.c.max_id
        ).subquery()

        query = select(
            models.Incidencia,
            latest_comment_q.c.comentario.label('ultimo_comentario_texto'),
            latest_comment_q.c.fecha_actualizacion.label('ultimo_comentario_fecha')
        ).outerjoin(
            latest_comment_q, models.Incidencia.id == latest_comment_q.c.incidencia_id
        ).options(
            selectinload(models.Incidencia.campana),
            selectinload(models.Incidencia.asignado_a)
        ).filter(
            models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
        ).order_by(
            case(
                (models.Incidencia.gravedad == GravedadIncidencia.ALTA, 1),
                (models.Incidencia.gravedad == GravedadIncidencia.MEDIA, 2),
                (models.Incidencia.gravedad == GravedadIncidencia.BAJA, 3),
                else_=4
            ),
            models.Incidencia.fecha_apertura.desc()
        )

        result = await db.execute(query)
        return result.all()
