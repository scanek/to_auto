import os
import datetime
import bcrypt
from typing import Optional
import jwt
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User, UserRole

import secrets
from app.core.config import DATA_DIR

def _get_or_create_jwt_secret() -> str:
    """
    Retrieves SECRET_KEY from environment or securely generates and persists
    a unique 64-byte secret in DATA_DIR/.jwt_secret across container restarts.
    No hardcoded secrets exist in source control.
    """
    env_secret = os.getenv("SECRET_KEY")
    if env_secret and len(env_secret.strip()) >= 32:
        return env_secret.strip()
    
    secret_file = DATA_DIR / ".jwt_secret"
    if secret_file.exists():
        try:
            stored = secret_file.read_text(encoding="utf-8").strip()
            if len(stored) >= 32:
                return stored
        except Exception:
            pass
            
    # Generate new cryptographically strong random token
    new_secret = secrets.token_urlsafe(64)
    try:
        secret_file.write_text(new_secret, encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not persist JWT secret to {secret_file}: {e}")
    return new_secret

# Secret key and JWT config
SECRET_KEY = _get_or_create_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        # bcrypt requires bytes
        password_bytes = plain_password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

async def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not authorization:
        return None
    token = authorization
    if token.startswith("Bearer "):
        token = token[7:].strip()
    
    payload = decode_access_token(token)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    try:
        res = await db.execute(select(User).where(User.id == int(user_id)))
        user = res.scalar_one_or_none()
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация для доступа к гаражу",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization:
        raise credentials_exception

    token = authorization
    if token.startswith("Bearer "):
        token = token[7:].strip()

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    res = await db.execute(select(User).where(User.id == int(user_id)))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception

    return user

async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуются права администратора",
        )
    return current_user

# Alias for backward compatibility if needed
require_admin = get_current_user
