# backend/security.py

from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

# --- CARGA SEGURA DE LA CLAVE SECRETA ---
load_dotenv() # Carga las variables del archivo .env

# Usamos os.getenv para leer la clave. Si no existe, usamos una por defecto (SOLO para desarrollo).
SECRET_KEY = os.getenv("SECRET_KEY", "una-clave-secreta-por-defecto-muy-larga-y-dificil")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # El token expira en 30 minutos
# --- FIN DE LA CARGA SEGURA ---


# Configuración para el hash de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña plana coincide con una encriptada."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera el hash de una contraseña."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un token de acceso JWT."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodifica un token de acceso JWT y devuelve sus datos."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None