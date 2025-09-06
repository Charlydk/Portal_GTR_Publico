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