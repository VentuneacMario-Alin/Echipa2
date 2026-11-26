from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import admin_only
from ..models import User
from ..schemas import UserResponse, UserUpdate

router = APIRouter(tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return db.scalars(select(User).order_by(User.name, User.id)).all()


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db),
                admin: User = Depends(admin_only)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    values = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and (values.get("role", "admin") != "admin" or values.get("is_active") is False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Administrators cannot demote or deactivate their own account.",
        )
    for key, value in values.items():
        if value is None:
            raise HTTPException(status_code=422, detail=f"{key} cannot be null.")
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

