from datetime import datetime, date

def decimal_to_hhmm(decimal_hours):
    """Convierte un número decimal de horas a formato HH:MM."""
    if decimal_hours is None or not isinstance(decimal_hours, (int, float)):
        return "00:00"
    hours = int(decimal_hours)
    minutes = int(round((decimal_hours - hours) * 60))
    return f"{hours:02d}:{minutes:02d}"

def formatear_rut(rut: str) -> str:
    """Limpia y formatea un RUT al formato XXXXXXXX-K."""
    if not isinstance(rut, str):
        return ""
    # 1. Quitar puntos y guiones
    rut_limpio = rut.replace('.', '').replace('-', '')
    # 2. Convertir a mayúsculas por si la 'k' está en minúscula
    rut_limpio = rut_limpio.upper()
    # 3. Separar el cuerpo del dígito verificador
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]
    # 4. Devolver en el formato estándar
    return f"{cuerpo}-{dv}"

def get_current_hhee_period():
    """
    Calcula el periodo actual de HHEE (26 del mes anterior al 25 del mes actual).
    Si hoy es >= 26, el periodo termina el 25 del mes siguiente.
    """
    today = date.today()
    if today.day >= 26:
        start = date(today.year, today.month, 26)
        if today.month == 12:
            end = date(today.year + 1, 1, 25)
        else:
            end = date(today.year, today.month + 1, 25)
    else:
        if today.month == 1:
            start = date(today.year - 1, 12, 26)
        else:
            start = date(today.year, today.month - 1, 26)
        end = date(today.year, today.month, 25)
def get_timezone_by_country(country_code: str) -> str:
    """
    Devuelve la zona horaria correspondiente al código de país.
    Chile (CL) usa America/Santiago.
    Argentina (AR) usa America/Argentina/Tucuman (por defecto).
    """
    if not country_code:
        return "America/Argentina/Tucuman"
    
    country_code = country_code.upper()
    if country_code == "CL":
        return "America/Santiago"
    elif country_code == "AR":
        return "America/Argentina/Tucuman"
    
    return "America/Argentina/Tucuman"
