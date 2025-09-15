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
    
    CHUNK_SIZE = 20
    todos_los_usuarios_gv = []

    for i in range(0, len(ruts_limpios), CHUNK_SIZE):
        lote_ruts = ruts_limpios[i:i + CHUNK_SIZE]
        payload = {
            "StartDate": fecha_inicio_dt.strftime("%Y%m%d%H%M%S"),
            "EndDate": fecha_fin_dt.strftime("%Y%m%d%H%M%S"),
            "UserIds": ",".join(lote_ruts)
        }
        
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(GEOVICTORIA_ATTENDANCE_URL, json=payload, headers=headers)
                response.raise_for_status()
                respuesta_lote = response.json()
                
                if respuesta_lote.get("Users"):
                    todos_los_usuarios_gv.extend(respuesta_lote["Users"])
        except Exception as e:
            print(f"Error en el servicio de GeoVictoria para el lote {i // CHUNK_SIZE + 1}: {e}")
            continue

    if not todos_los_usuarios_gv:
        return []
    
    dias_procesados_total = []
    
    for usuario in todos_los_usuarios_gv:
        rut_usuario = usuario.get('Identifier')
        intervalos = usuario.get("PlannedInterval", []) or []
        
        for intervalo_diario in intervalos:
            fecha_str = intervalo_diario.get("Date", "")
            if not fecha_str: continue

            fecha_dt = datetime.strptime(fecha_str, '%Y%m%d%H%M%S')
            fecha_actual_str = fecha_dt.strftime('%Y-%m-%d')

            marcas = sorted([p for p in intervalo_diario.get("Punches", []) or [] if p.get("Date")], key=lambda x: x['Date'])
            
            entradas = []
            salidas = []
            if marcas:
                # Convertimos todas las marcas a objetos datetime para poder compararlas
                marcas_dt = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas]
                # La primera marca del día (la más temprana) es siempre la entrada
                entradas.append(min(marcas_dt))
                # Si hay más de una marca, la última (la más tardía) es la salida
                if len(marcas_dt) > 1:
                    salidas.append(max(marcas_dt))
            
            turno = (intervalo_diario.get("Shifts", []) or [{}])[0]
            
            permisos_del_dia = [
                p.get("TimeOffTypeDescription") 
                for p in intervalo_diario.get("TimeOffs", []) or [] 
                if p.get("TimeOffTypeDescription")
            ]

            datos_dia = {
                "fecha": fecha_actual_str,
                "nombre_apellido": f"{usuario.get('Name', '')} {usuario.get('LastName', '')}".strip(),
                "rut_limpio": rut_usuario,
                "rut": rut_usuario,
                "campaña": usuario.get('GroupDescription'),
                "inicio_turno_teorico": turno.get('StartTime'),
                "fin_turno_teorico": turno.get('ExitTime'),
                "marca_real_inicio": min(entradas).strftime('%H:%M') if entradas else None,
                "marca_real_fin": max(salidas).strftime('%H:%M') if salidas else None,
                "hhee_autorizadas_antes_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeBefore")),
                "hhee_autorizadas_despues_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeAfter")),
                "permisos": permisos_del_dia
            }
            dias_procesados_total.append(datos_dia)
            
    return dias_procesados_total
    
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

    # Asignamos una fecha base para poder comparar momentos en el tiempo
    fecha_base = datetime.strptime(datos_procesados.get("fecha"), '%Y-%m-%d')
    inicio_real = fecha_base.replace(hour=int(inicio_real_str[:2]), minute=int(inicio_real_str[3:]))
    fin_real = fecha_base.replace(hour=int(fin_real_str[:2]), minute=int(fin_real_str[3:]))
    
    hhee_inicio, hhee_fin = 0, 0
    tipo_hhee = ""

    es_descanso = not inicio_teorico_str or inicio_teorico_str.lower() == 'descanso' or (inicio_teorico_str == "00:00" and fin_teorico_str == "00:00")

    if es_descanso:
        tipo_hhee = "Día de Descanso"
        if fin_real < inicio_real:
            fin_real += timedelta(days=1)
        hhee_inicio = (fin_real - inicio_real).total_seconds() / 3600
    else:
        inicio_teorico = fecha_base.replace(hour=int(inicio_teorico_str[:2]), minute=int(inicio_teorico_str[3:]))
        fin_teorico = fecha_base.replace(hour=int(fin_teorico_str[:2]), minute=int(fin_teorico_str[3:]))

        if fin_teorico < inicio_teorico: # Turno nocturno
            fin_teorico += timedelta(days=1)

        if fin_real < inicio_real: # Marcas nocturnas
            fin_real += timedelta(days=1)

        # --- INICIO DE LA CORRECCIÓN CLAVE ---
        # Comparamos los objetos datetime completos, no solo la hora con .time()
        if inicio_real < inicio_teorico:
            tipo_hhee += "Antes de Turno "
            hhee_inicio = (inicio_teorico - inicio_real).total_seconds() / 3600

        if fin_real > fin_teorico:
            tipo_hhee += "Después de Turno"
            hhee_fin = (fin_real - fin_teorico).total_seconds() / 3600
        # --- FIN DE LA CORRECCIÓN CLAVE ---

    hhee_calculadas_total = max(0, hhee_inicio) + max(0, hhee_fin)

    return {
        "tipo_hhee": tipo_hhee.strip(),
        "cantidad_hhee_calculadas": round(hhee_calculadas_total, 2),
        "hhee_inicio_calculadas": round(max(0, hhee_inicio), 2) if not es_descanso else 0,
        "hhee_fin_calculadas": round(max(0, hhee_fin), 2) if not es_descanso else 0
    }
