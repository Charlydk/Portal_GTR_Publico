import asyncio
from database import engine, Base, DATABASE_URL # Importamos la variable

# --- LÍNEA DE VERIFICACIÓN ---
print(f"--- [Script create_db] Modificando DB en: {DATABASE_URL} ---")
# -----------------------------

from sql_app.models import (
    Analista, Campana, Tarea, ChecklistItem, ComentarioGeneralBitacora,
    Aviso, AcuseReciboAviso, BitacoraEntry, TareaGeneradaPorAviso,
    HistorialEstadoTarea, Incidencia, ActualizacionIncidencia
)

async def create_db_and_tables():
    print("Conectando para recrear las tablas...")
    async with engine.begin() as conn:
        print("Borrando tablas antiguas...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creando tablas nuevas...")
        await conn.run_sync(Base.metadata.create_all)
    print("¡Éxito! Las tablas han sido recreadas.")

if __name__ == "__main__":
    asyncio.run(create_db_and_tables())
