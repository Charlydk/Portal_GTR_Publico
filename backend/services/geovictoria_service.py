# /backend/services/geovictoria_service.py
import httpx
import os
import pandas as pd
from datetime import datetime, timedelta
from typing import List

GEOVICTORIA_USER = os.getenv("GEOVICTORIA_USER")
GEOVICTORIA_PASSWORD = os.getenv("GEOVICTORIA_PASSWORD")
GEOVICTORIA_LOGIN_URL = "https://customerapi.geovictoria.com/api/v1/Login"
GEOVICTORIA_ATTENDANCE_URL = "https://customerapi.geovictoria.com/api/v1/AttendanceBook"


async def obtener_token_geovictoria():
    if not GEOVICTORIA_USER or not GEOVICTORIA_PASSWORD:
        print("ERROR: Faltan las credenciales de GeoVictoria en las variables de entorno.")
        return None

    payload = {"User": GEOVICTORIA_USER, "Password": GEOVICTORIA_PASSWORD}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(GEOVICTORIA_LOGIN_URL, json=payload)
            response.raise_for_status()
            return response.json().get("token")
    except httpx.RequestError as exc:
        print(f"Error de conexión al obtener token de GeoVictoria: {exc}")
        return None
    
def hhmm_to_decimal(time_str):
    if not time_str or not isinstance(time_str, str) or ':' not in time_str: return 0
    parts = time_str.split(':')
    try:
        return int(parts[0]) + (int(parts[1]) / 60)
    except (ValueError, IndexError):
        return 0

async def obtener_datos_completos_periodo(token: str, ruts_limpios: list[str], fecha_inicio_dt: datetime, fecha_fin_dt: datetime):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    payload = { "StartDate": fecha_inicio_dt.strftime("%Y%m%d%H%M%S"), "EndDate": fecha_fin_dt.strftime("%Y%m%d%H%M%S"), "UserIds": ",".join(ruts_limpios) }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GEOVICTORIA_ATTENDANCE_URL, json=payload, headers=headers)
            response.raise_for_status()
            respuesta_gv = response.json()

        dias_procesados_total = []
        usuarios = respuesta_gv.get("Users", [])
        if not usuarios:
            return []

        for usuario in usuarios:
            
            rut_usuario = usuario.get('Identifier') # Usamos 'Identifier' en lugar de 'Id'
            
            intervalos_por_fecha = {pd.to_datetime(intervalo.get("Date", ""), format="%Y%m%d%H%M%S").strftime('%Y-%m-%d'): intervalo for intervalo in usuario.get("PlannedInterval", [])}
            current_date = fecha_inicio_dt.date()
            while current_date <= fecha_fin_dt.date():
                fecha_actual_str = current_date.strftime('%Y-%m-%d')
                datos_dia = {
                    "fecha": fecha_actual_str, "nombre_apellido": f"{usuario.get('Name', '')} {usuario.get('LastName', '')}".strip(), 
                    "rut_limpio": rut_usuario, "campaña": usuario.get('GroupDescription'), 
                    "inicio_turno_teorico": None, "fin_turno_teorico": None, "marca_real_inicio": None, "marca_real_fin": None, 
                    "hhee_autorizadas_antes_gv": 0, "hhee_autorizadas_despues_gv": 0
                }
                intervalo_diario = intervalos_por_fecha.get(fecha_actual_str)
                if intervalo_diario:
                    marcas = intervalo_diario.get("Punches", [])
                    entradas = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas if p.get('ShiftPunchType') == 'Entrada']
                    salidas = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas if p.get('ShiftPunchType') == 'Salida']
                    turno = intervalo_diario.get("Shifts", [{}])[0]
                    datos_dia.update({
                        "inicio_turno_teorico": turno.get('StartTime'), "fin_turno_teorico": turno.get('ExitTime'), 
                        "marca_real_inicio": min(entradas).strftime('%H:%M') if entradas else None, 
                        "marca_real_fin": max(salidas).strftime('%H:%M') if salidas else None, 
                        "hhee_autorizadas_antes_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeBefore")), 
                        "hhee_autorizadas_despues_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeAfter"))
                    })
                dias_procesados_total.append(datos_dia)
                current_date += timedelta(days=1)
        return dias_procesados_total
    except Exception as e:
        print(f"Error en el servicio de GeoVictoria: {e}")
        return []
    
def aplicar_logica_de_negocio(datos_procesados):
    """
    Calcula las HHEE de inicio, fin o descanso basado en los datos de un día.
    Esta es una traducción directa de la lógica de tu app Flask.
    """
    inicio_teorico_str = datos_procesados.get("inicio_turno_teorico")
    fin_teorico_str = datos_procesados.get("fin_turno_teorico")
    inicio_real_str = datos_procesados.get("marca_real_inicio")
    fin_real_str = datos_procesados.get("marca_real_fin")

    if not inicio_real_str or not fin_real_str:
        return { "tipo_hhee": "Sin Marcas", "hhee_inicio_calculadas": 0, "hhee_fin_calculadas": 0, "cantidad_hhee_calculadas": 0}

    inicio_real = datetime.strptime(inicio_real_str, '%H:%M')
    fin_real = datetime.strptime(fin_real_str, '%H:%M')
    hhee_inicio, hhee_fin = 0, 0
    tipo_hhee = ""

    es_descanso = not inicio_teorico_str or inicio_teorico_str.lower() == 'descanso' or (inicio_teorico_str == "00:00" and fin_teorico_str == "00:00")

    if es_descanso:
        tipo_hhee = "Día de Descanso"
        # Si las marcas cruzan la medianoche, ajustamos
        if fin_real < inicio_real:
            fin_real += timedelta(days=1)
        hhee_inicio = (fin_real - inicio_real).total_seconds() / 3600
    else:
        inicio_teorico = datetime.strptime(inicio_teorico_str, '%H:%M')
        fin_teorico = datetime.strptime(fin_teorico_str, '%H:%M')

        if fin_teorico < inicio_teorico: # Turno nocturno
            fin_teorico += timedelta(days=1)

        if fin_real < inicio_real: # Marcas nocturnas
            fin_real += timedelta(days=1)

        if inicio_real.time() < inicio_teorico.time():
            tipo_hhee += "Antes de Turno "
            hhee_inicio = (inicio_teorico - inicio_real).total_seconds() / 3600

        if fin_real.time() > fin_teorico.time():
            tipo_hhee += "Después de Turno"
            hhee_fin = (fin_real - fin_teorico).total_seconds() / 3600

    hhee_calculadas_total = max(0, hhee_inicio) + max(0, hhee_fin)

    return {
        "tipo_hhee": tipo_hhee.strip(),
        "cantidad_hhee_calculadas": round(hhee_calculadas_total, 2),
        "hhee_inicio_calculadas": round(max(0, hhee_inicio), 2) if not es_descanso else 0,
        "hhee_fin_calculadas": round(max(0, hhee_fin), 2) if not es_descanso else 0
    }
