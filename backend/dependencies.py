"""Dependențe FastAPI comune: autentificare și verificarea rolurilor."""
import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User


def current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    try:
        payload = jwt.decode(access_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError, jwt.PyJWTError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    return user


def editor_only(user: User = Depends(current_user)) -> User:
    if user.role not in {"admin", "editor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor permissions required.")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permissions required.")
    return user
