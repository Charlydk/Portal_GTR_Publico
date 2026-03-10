from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class IncidenciaCreate(BaseModel):
    titulo: str
    fecha_apertura: Optional[datetime] = None

data = {"titulo": "Un titulo de prueba"}
incidencia = IncidenciaCreate(**data)
dumped = incidencia.model_dump()

print("Dumped:", dumped)
if dumped.get("fecha_apertura") is None:
    print("El campo is None, entraremos al IF.")
else:
    print("El campo no es None.")
