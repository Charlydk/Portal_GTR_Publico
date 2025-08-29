# /backend/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from database import get_db
from sql_app import models
from enums import UserRole
from schemas.auth_schemas import TokenData
from security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_analista(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> models.Analista:
    print(f"--- TOKEN RECIBIDO POR EL BACKEND: {token} ---")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload is None: raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        token_data = TokenData(email=email)
    except Exception:
        raise credentials_exception

    result = await db.execute(
        select(models.Analista).filter(models.Analista.email == token_data.email)
        .options(selectinload(models.Analista.campanas_asignadas))
    )
    analista = result.scalars().first()
    if analista is None:
        raise credentials_exception
    return analista

def require_role(required_roles: List[UserRole]):
    def role_checker(current_analista: models.Analista = Depends(get_current_analista)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker