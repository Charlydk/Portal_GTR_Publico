# backend/security.py

from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import os

# --- CARGA SEGURA DE LA CLAVE SECRETA ---
SECRET_KEY = os.getenv("SECRET_KEY", "una-clave-secreta-por-defecto-muy-larga-y-dificil")
ALGORITHM = "HS256"

# --- NUEVOS TIEMPOS DE EXPIRACIÓN ---
ACCESS_TOKEN_EXPIRE_MINUTES = 1  # El token de acceso sigue durando 30 minutos
REFRESH_TOKEN_EXPIRE_DAYS = 7     # El token de refresco durará 7 días
# -----------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    """Crea un token de acceso de corta duración."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- NUEVA FUNCIÓN PARA EL REFRESH TOKEN ---
def create_refresh_token(data: dict) -> str:
    """Crea un token de refresco de larga duración."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
# ----------------------------------------

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None