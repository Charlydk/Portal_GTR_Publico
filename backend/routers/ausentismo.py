from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from ..dependencies import get_db
from ..services.ausentismo_service import (
    upsert_ausentismo_usuarios,
    parse_and_insert_planificacion,
    parse_and_insert_adereso,
    parse_and_insert_mediatel
)

router = APIRouter(
    prefix="/ausentismo",
    tags=["ausentismo"]
)

@router.post("/subir-usuarios")
async def api_subir_usuarios(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    return await upsert_ausentismo_usuarios(data, db)

@router.post("/subir-planificacion")
async def api_subir_planificacion(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    return await parse_and_insert_planificacion(data, db)

@router.post("/subir-log-adereso")
async def api_subir_log_adereso(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    return await parse_and_insert_adereso(data, db)

@router.post("/subir-log-mediatel")
async def api_subir_log_mediatel(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    is_csv = file.filename.endswith(".csv")
    return await parse_and_insert_mediatel(data, is_csv, db)

@router.get("/reporte-diario")
async def api_reporte_diario(fecha: str, db: AsyncSession = Depends(get_db)):
    # fecha en formato YYYY-MM-DD
    from ..services.ausentismo_service import get_reporte_ausentismo
    return await get_reporte_ausentismo(fecha, db)
