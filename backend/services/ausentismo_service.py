import pandas as pd
from io import BytesIO
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import delete, insert
from ..sql_app.models import AusentismoUsuario, AusentismoPlanificacion, AusentismoConexion
from datetime import datetime, date

# ---- helper de insert por lotes ------------------------------------
BATCH_SIZE = 500

async def _batch_insert(db: AsyncSession, model, items: list):
    """Divide items en chunks de BATCH_SIZE e inserta uno por vez.
    Así cada sentencia corre dentro del command_timeout de la conexión.
    """
    for i in range(0, len(items), BATCH_SIZE):
        chunk = items[i:i + BATCH_SIZE]
        await db.execute(insert(model).values(chunk))
    await db.commit()
# -------------------------------------------------------------------

async def upsert_ausentismo_usuarios(file_bytes: bytes, db: AsyncSession):
    df = pd.read_excel(BytesIO(file_bytes))
    
    recs_map = {}
    for _, row in df.iterrows():
        rut = str(row.get("RUT 2", "")).strip()
        if not rut or rut == "nan":
            continue
            
        id_avaya = str(row.get("Usuarios Avaya", ""))
        id_mediatel = str(row.get("Usuarios Mediatel", ""))
        id_adereso = str(row.get("Usuario RRSS", ""))
        
        recs_map[rut] = {
            "rut": rut,
            "nombre": str(row.get("First Name", "")),
            "apellido": str(row.get("Last Name", "")),
            "id_avaya": None if id_avaya.lower() == "nan" else id_avaya.replace(".0", ""),
            "id_mediatel": None if id_mediatel.lower() == "nan" else id_mediatel.replace(".0", ""),
            "id_adereso": None if id_adereso.lower() == "nan" else id_adereso
        }
        
    recs_to_insert = list(recs_map.values())
        
    if not recs_to_insert:
        return {"status": "success", "upserted": 0}

    stmt = pg_insert(AusentismoUsuario).values(recs_to_insert)
    update_dict = {
        c.name: c for c in stmt.excluded if c.name != 'id'
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=['rut'],
        set_=update_dict
    )
    
    await db.execute(stmt)
    await db.commit()
    return {"status": "success", "upserted": len(recs_to_insert)}


async def parse_and_insert_planificacion(file_bytes: bytes, db: AsyncSession):
    # Intentamos deducir el lunes de la semana por el nombre del archivo si fuera posible,
    # pero como recibimos bytes, asumiremos el lunes 13 de abril de 2026 como base para este crudo.
    base_monday = date(2026, 4, 13)
    df = pd.read_excel(BytesIO(file_bytes))
    
    # Mapeo de columnas de día a fecha
    days_map = {
        "Monday": base_monday,
        "Tuesday": base_monday + pd.Timedelta(days=1),
        "Wednesday": base_monday + pd.Timedelta(days=2),
        "Thursday": base_monday + pd.Timedelta(days=3),
        "Friday": base_monday + pd.Timedelta(days=4),
        "Saturday": base_monday + pd.Timedelta(days=5),
        "Sunday": base_monday + pd.Timedelta(days=6)
    }
    
    # 1. Obtener mapeo de RUT 2 -> usuario_id
    stmt = select(AusentismoUsuario)
    result = await db.execute(stmt)
    users = result.scalars().all()
    rut_map = {u.rut: u.id for u in users}
    
    items = []
    for _, row in df.iterrows():
        rut = str(row.get("RUT 2 / CUIL", "")).strip()
        if not rut or rut == "nan":
            continue
            
        u_id = rut_map.get(rut)
        if not u_id:
            continue
            
        for day_name, current_date in days_map.items():
            val = str(row.get(day_name, "")).strip().upper()
            if not val or val == "NAN":
                continue
            
            # Si el dia es OFF o LOA, lo guardamos para preservar el LOB, pero sin horas.
            start_time = None
            end_time = None
            
            if " - " in val:
                try:
                    start_str, end_str = val.split(" - ")
                    start_time = datetime.strptime(start_str.strip(), "%H:%M").time()
                    end_time = datetime.strptime(end_str.strip(), "%H:%M").time()
                except Exception:
                    pass
                    
            if not start_time and val not in ["OFF", "LOA"]:
                continue # Formato invalido y no es OFF
                
            items.append({
                "usuario_id": u_id,
                "fecha": current_date,
                "hora_inicio": start_time,
                "hora_fin": end_time,
                "campana": str(row.get("LOB", "Walmart"))
            })

    if items:
        unique_dates = list(set(i['fecha'] for i in items if i['fecha']))
        for d in unique_dates:
            await db.execute(delete(AusentismoPlanificacion).where(AusentismoPlanificacion.fecha == d))
        await db.commit()
        await _batch_insert(db, AusentismoPlanificacion, items)
        
    return {"status": "success", "inserted": len(items)}


async def parse_and_insert_adereso(file_bytes: bytes, db: AsyncSession):
    df = pd.read_excel(BytesIO(file_bytes))
    # Nombre Completo, Estado, Motivo, Hora Inicio, Hora Fin, Duración
    
    # 1. Fetch map of Adereso ID (nombre) -> Usuario ID
    stmt = select(AusentismoUsuario).where(AusentismoUsuario.id_adereso.isnot(None))
    result = await db.execute(stmt)
    users = result.scalars().all()
    user_map = {u.id_adereso.lower(): u.id for u in users}
    
    items = []
    for _, row in df.iterrows():
        nombre = str(row.get("Nombre Completo", "")).lower().split(" - ")[0].strip()
        u_id = user_map.get(nombre)
        
        if not u_id:
            continue
            
        estado = str(row.get("Estado", ""))
        if estado.lower() == "offline":
            continue
            
        try:
            h_inicio = row.get("Hora Inicio")
            h_fin = row.get("Hora Fin")
            
            if pd.isna(h_inicio):
                continue
                
            items.append({
                "usuario_id": u_id,
                "herramienta": "Adereso",
                "evento": f"{estado} ({row.get('Motivo', '')})",
                "hora_inicio": pd.to_datetime(h_inicio).to_pydatetime(),
                "hora_fin": pd.to_datetime(h_fin).to_pydatetime() if pd.notna(h_fin) else None
            })
        except Exception:
            continue
            
    if items:
        unique_dates = list(set(i['hora_inicio'].date() for i in items if i['hora_inicio']))
        for d in unique_dates:
            dt_start = datetime.combine(d, datetime.min.time())
            dt_end = datetime.combine(d, datetime.max.time())
            await db.execute(
                delete(AusentismoConexion).where(
                    AusentismoConexion.herramienta == "Adereso",
                    AusentismoConexion.hora_inicio >= dt_start,
                    AusentismoConexion.hora_inicio <= dt_end
                )
            )
        await db.commit()
        await _batch_insert(db, AusentismoConexion, items)
        
    return {"status": "success", "inserted": len(items)}

async def parse_and_insert_mediatel(file_bytes: bytes, is_csv: bool, db: AsyncSession):
    if is_csv:
        df = pd.read_csv(BytesIO(file_bytes))
    else:
        df = pd.read_excel(BytesIO(file_bytes))
        
    # AGENTID, AGENTNAME, FECHA, LOGINDATE, LOGOUTDATE, EVENTNAME
    
    stmt = select(AusentismoUsuario).where(AusentismoUsuario.id_mediatel.isnot(None))
    result = await db.execute(stmt)
    users = result.scalars().all()
    user_map = {u.id_mediatel: u.id for u in users}
    
    items = []
    for _, row in df.iterrows():
        agent_id = str(row.get("AGENTID", "")).replace(".0", "")
        u_id = user_map.get(agent_id)
        
        if not u_id:
            continue
            
        try:
            h_inicio = row.get("LOGINDATE")
            h_fin = row.get("LOGOUTDATE")
            
            if pd.isna(h_inicio):
                continue
                
            items.append({
                "usuario_id": u_id,
                "herramienta": "Mediatel",
                "evento": str(row.get("EVENTNAME", "S/N")),
                "hora_inicio": pd.to_datetime(h_inicio).to_pydatetime(),
                "hora_fin": pd.to_datetime(h_fin).to_pydatetime() if pd.notna(h_fin) else None
            })
        except Exception:
            continue
            
    if items:
        unique_dates = list(set(i['hora_inicio'].date() for i in items if i['hora_inicio']))
        for d in unique_dates:
            dt_start = datetime.combine(d, datetime.min.time())
            dt_end = datetime.combine(d, datetime.max.time())
            await db.execute(
                delete(AusentismoConexion).where(
                    AusentismoConexion.herramienta == "Mediatel",
                    AusentismoConexion.hora_inicio >= dt_start,
                    AusentismoConexion.hora_inicio <= dt_end
                )
            )
        await db.commit()
        await _batch_insert(db, AusentismoConexion, items)
        
    return {"status": "success", "inserted": len(items)}

async def get_reporte_ausentismo(fecha_str: str, db: AsyncSession):
    from sqlalchemy import insert
    from sqlalchemy.orm import selectinload
    
    target_date = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    
    # 1. Traer todos los usuarios para tener la base
    stmt_users = select(AusentismoUsuario).options(
        selectinload(AusentismoUsuario.planificaciones),
        selectinload(AusentismoUsuario.conexiones)
    )
    result = await db.execute(stmt_users)
    usuarios = result.scalars().all()
    
    reporte = []
    
    for u in usuarios:
        # Filtrar planificacion del dia
        plan = [p for p in u.planificaciones if p.fecha == target_date]
        
        # Filtrar conexiones que inciaron ese dia (segun regla de negocio)
        cons = [c for c in u.conexiones if c.hora_inicio.date() == target_date]
        
        if not plan and not cons:
            continue
            
        # Calcular horas planificadas
        horas_plan_total = 0
        plan_desc = "OFF"
        if plan:
            p = plan[0]
            if p.hora_inicio and p.hora_fin:
                plan_desc = f"{p.hora_inicio.strftime('%H:%M')} - {p.hora_fin.strftime('%H:%M')}"
                start_dt = datetime.combine(target_date, p.hora_inicio)
                end_dt = datetime.combine(target_date, p.hora_fin)
                if end_dt < start_dt:
                    end_dt += pd.Timedelta(days=1)
                horas_plan_total = (end_dt - start_dt).total_seconds() / 3600

        # Herramientas
        adereso_logs = [c for c in cons if c.herramienta == "Adereso"]
        mediatel_logs = [c for c in cons if c.herramienta == "Mediatel"]
        
        def sum_durations(logs):
            total_sec = 0
            for l in logs:
                if l.hora_fin:
                    total_sec += (pd.to_datetime(l.hora_fin) - pd.to_datetime(l.hora_inicio)).total_seconds()
            return total_sec / 3600

        h_adereso = sum_durations(adereso_logs)
        h_mediatel = sum_durations(mediatel_logs)
        
        # Detección de concurrencia
        concurrente = False
        for a in adereso_logs:
            for m in mediatel_logs:
                if a.hora_fin and m.hora_fin:
                    if max(a.hora_inicio, m.hora_inicio) < min(a.hora_fin, m.hora_fin):
                        concurrente = True
                        break
            if concurrente: break

        total_logueo = h_adereso + h_mediatel
        if horas_plan_total == 0:
            estado_agente = "Turno Extra" if total_logueo >= 0.1 else "Libre"
        else:
            estado_agente = "Presente" if total_logueo >= 0.1 else "Ausente"

        reporte.append({
            "rut": u.rut,
            "nombre": f"{u.nombre} {u.apellido}",
            "campana": plan[0].campana if plan else "Sin Asignar",
            "planificado": plan_desc,
            "hora_inicio_plan": plan[0].hora_inicio.strftime('%H:%M') if plan and plan[0].hora_inicio else None,
            "horas_plan": round(horas_plan_total, 2),
            "h_adereso": round(h_adereso, 2),
            "h_mediatel": round(h_mediatel, 2),
            "concurrente": concurrente,
            "estado": estado_agente
        })
        
    return reporte
