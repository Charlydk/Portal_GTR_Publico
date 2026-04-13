import asyncio
import pytz
from datetime import datetime, timezone, timedelta
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from .database import AsyncSessionLocal
from .sql_app import models

async def poblado_diario_bolsa_reporteria():
    """Busca las plantillas activas y genera la bolsa para el día, filtrando por día de la semana."""
    try:
        async with AsyncSessionLocal() as db:
            hoy = datetime.now(timezone.utc).date()
            
            # Verificar si ya se corrió hoy
            q_existentes = select(models.BolsaTareasReporteria).filter(
                models.BolsaTareasReporteria.fecha_tarea == hoy
            )
            res = await db.execute(q_existentes)
            if res.scalars().first():
                return # Ya existen tareas hoy
            
            # Determinar día de la semana (0=lunes, ..., 6=domingo)
            dia_semana = hoy.weekday()
            dias_mapeo = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
            campo_dia = dias_mapeo[dia_semana]

            # Filtrar plantillas activas que tengan habilitado el día de hoy
            q_plantillas = select(models.CatalogoTareasReporteria).filter(
                models.CatalogoTareasReporteria.activa == True,
                getattr(models.CatalogoTareasReporteria, campo_dia) == True
            )
            res_p = await db.execute(q_plantillas)
            plantillas = res_p.scalars().all()
            
            for p in plantillas:
                nueva_tarea = models.BolsaTareasReporteria(
                    categoria=p.categoria,
                    nombre=p.nombre,
                    descripcion=p.descripcion or f"Generado automáticamente desde {p.nombre}",
                    hora_vencimiento=p.hora_vencimiento,
                    estado="PENDIENTE",
                    fecha_tarea=hoy
                )
                db.add(nueva_tarea)
                
            await db.commit()
            print(f"Bolsa diaria de reportería generada: {len(plantillas)} tareas ({campo_dia}).")
    except Exception as e:
        print(f"Error generando bolsa diaria: {e}")

async def run_cron_jobs():
    """Bucle infinito que calcula el tiempo hasta la próxima medianoche y ejecuta las tareas."""
    tz_argentina = pytz.timezone("America/Argentina/Tucuman")
    
    # Arrancar poblado inicial si es que se levanta el servidor y no está hecho:
    await poblado_diario_bolsa_reporteria()
    
    while True:
        ahora = datetime.now(tz_argentina)
        manana = (ahora + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        segundos_espera = (manana - ahora).total_seconds()
        
        await asyncio.sleep(segundos_espera)
        
        # Al despertar (después de medianoche)
        await poblado_diario_bolsa_reporteria()
