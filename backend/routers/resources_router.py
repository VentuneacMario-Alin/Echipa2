import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import (
    Booking,
    Category,
    Resource,
    ResourceAttribute,
    ResourceAttachment,
    ResourceTag,
    ResourceType,
    Tag,
    User,
)
from ..schemas import (
    AttachmentCreate,
    BookingCreate,
    BookingRead,
    CategoryCreate,
    CategoryRead,
    ResourceCreate,
    ResourceRead,
    ResourceTypeCreate,
    ResourceTypeRead,
    ResourceUpdate,
)

router = APIRouter(prefix="/resources", tags=["Resources"])


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


def ensure_related(db: Session, payload: ResourceCreate | ResourceUpdate) -> None:
    if payload.type_id is not None and db.get(ResourceType, payload.type_id) is None:
        raise HTTPException(status_code=404, detail="Resource type not found.")
    if payload.category_id is not None and db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    if payload.owner_id is not None and db.get(User, payload.owner_id) is None:
        raise HTTPException(status_code=404, detail="Owner not found.")


def get_resource_or_404(db: Session, resource_id: int) -> Resource:
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    return resource


def sync_metadata(db: Session, resource_id: int, tags: list[str] | None, attributes: dict[str, str] | None,
                  attachments: list[AttachmentCreate] | None, user_id: int) -> None:
    if tags is not None:
        db.execute(delete(ResourceTag).where(ResourceTag.resource_id == resource_id))
        for name in {tag.strip().lower() for tag in tags if tag.strip()}:
            tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name))
            if tag is None:
                tag = Tag(name=name)
                db.add(tag)
                db.flush()
            db.add(ResourceTag(resource_id=resource_id, tag_id=tag.id))
    if attributes is not None:
        db.execute(delete(ResourceAttribute).where(ResourceAttribute.resource_id == resource_id))
        for key, value in attributes.items():
            if key.strip() and value.strip():
                db.add(ResourceAttribute(resource_id=resource_id, attr_key=key.strip(), attr_value=value.strip()))
    if attachments is not None:
        db.execute(delete(ResourceAttachment).where(ResourceAttachment.resource_id == resource_id))
        for item in attachments:
            db.add(ResourceAttachment(resource_id=resource_id, uploaded_by=user_id, **item.model_dump()))


def serialize_resource(db: Session, resource: Resource) -> ResourceRead:
    type_name = db.scalar(select(ResourceType.name).where(ResourceType.id == resource.type_id)) or ""
    category_name = db.scalar(select(Category.name).where(Category.id == resource.category_id))
    tag_names = db.scalars(
        select(Tag.name).join(ResourceTag, ResourceTag.tag_id == Tag.id)
        .where(ResourceTag.resource_id == resource.id).order_by(Tag.name)
    ).all()
    attributes = {
        row.attr_key: row.attr_value
        for row in db.scalars(select(ResourceAttribute).where(ResourceAttribute.resource_id == resource.id)).all()
    }
    attachments = db.scalars(
        select(ResourceAttachment).where(ResourceAttachment.resource_id == resource.id)
    ).all()
    return ResourceRead(
        **{key: getattr(resource, key) for key in (
            "id", "name", "description", "type_id", "category_id", "status", "location",
            "identifier", "acquired_on", "owner_id", "created_by", "updated_by", "created_at", "updated_at"
        )},
        type_name=type_name, category_name=category_name, tags=tag_names,
        attributes=attributes, attachments=attachments,
    )


@router.get("", response_model=list[ResourceRead])
def list_resources(
    q: str | None = None, status_filter: str | None = Query(default=None, alias="status"),
    type_id: int | None = None, category_id: int | None = None, tag: str | None = None,
    skip: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(Resource)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(Resource.name.ilike(term), Resource.description.ilike(term),
                                Resource.location.ilike(term), Resource.identifier.ilike(term)))
    if status_filter:
        query = query.where(Resource.status == status_filter)
    if type_id is not None:
        query = query.where(Resource.type_id == type_id)
    if category_id is not None:
        query = query.where(Resource.category_id == category_id)
    if tag:
        query = query.join(ResourceTag).join(Tag).where(func.lower(Tag.name) == tag.lower().strip())
    return [serialize_resource(db, item) for item in db.scalars(query.order_by(Resource.updated_at.desc()).offset(skip).limit(limit)).all()]


@router.post("", response_model=ResourceRead, status_code=201)
def create_resource(payload: ResourceCreate, db: Session = Depends(get_db), user: User = Depends(editor_only)):
    ensure_related(db, payload)
    resource = Resource(**payload.model_dump(exclude={"tags", "attributes", "attachments"}), created_by=user.id, updated_by=user.id)
    db.add(resource)
    db.flush()
    sync_metadata(db, resource.id, payload.tags, payload.attributes, payload.attachments, user.id)
    db.commit()
    db.refresh(resource)
    return serialize_resource(db, resource)


@router.get("/catalog/types", response_model=list[ResourceTypeRead])
def list_types(db: Session = Depends(get_db)):
    return db.scalars(select(ResourceType).order_by(ResourceType.name)).all()


@router.post("/catalog/types", response_model=ResourceTypeRead, status_code=201)
def create_type(payload: ResourceTypeCreate, db: Session = Depends(get_db), _: User = Depends(editor_only)):
    resource_type = ResourceType(**payload.model_dump())
    db.add(resource_type)
    db.commit()
    db.refresh(resource_type)
    return resource_type


@router.get("/catalog/categories", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post("/catalog/categories", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), _: User = Depends(editor_only)):
    if payload.parent_id is not None and db.get(Category, payload.parent_id) is None:
        raise HTTPException(status_code=404, detail="Parent category not found.")
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/{resource_id}/bookings", response_model=list[BookingRead])
def list_resource_bookings(resource_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    get_resource_or_404(db, resource_id)
    return db.scalars(
        select(Booking)
        .where(Booking.resource_id == resource_id)
        .order_by(Booking.start_at.asc())
    ).all()


@router.post("/{resource_id}/bookings", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(
    resource_id: int,
    payload: BookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    resource = get_resource_or_404(db, resource_id)

    overlapping = db.scalar(
        select(Booking.id)
        .where(
            Booking.resource_id == resource_id,
            Booking.status.in_(["pending", "confirmed", "active"]),
            Booking.start_at < payload.end_at,
            Booking.end_at > payload.start_at,
        )
        .limit(1)
    )
    if overlapping is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A booking already exists for this time window.",
        )

    if resource.status != "disponibil":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This resource is not available for booking at this moment.",
        )

    booking = Booking(
        resource_id=resource_id,
        user_id=user.id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        notes=payload.notes,
        status="confirmed",
    )
    db.add(booking)
    resource.status = "in_utilizare"
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/bookings/me", response_model=list[BookingRead])
def list_my_bookings(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(
        select(Booking)
        .where(Booking.user_id == user.id)
        .order_by(Booking.start_at.desc())
    ).all()


@router.patch("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.user_id != user.id and user.role not in {"admin", "editor"}:
        raise HTTPException(status_code=403, detail="You cannot cancel this booking.")

    booking.status = "cancelled"
    resource = db.get(Resource, booking.resource_id)
    if resource is not None:
        active_booking = db.scalar(
            select(Booking.id)
            .where(
                Booking.resource_id == resource.id,
                Booking.status.in_(["pending", "confirmed", "active"]),
                Booking.id != booking.id,
                Booking.start_at < booking.end_at,
                Booking.end_at > booking.start_at,
            )
            .limit(1)
        )
        if active_booking is None:
            resource.status = "disponibil"

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{resource_id}", response_model=ResourceRead)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = get_resource_or_404(db, resource_id)
    return serialize_resource(db, resource)


@router.patch("/{resource_id}", response_model=ResourceRead)
def update_resource(resource_id: int, payload: ResourceUpdate, db: Session = Depends(get_db),
                    user: User = Depends(editor_only)):
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    ensure_related(db, payload)
    values = payload.model_dump(exclude_unset=True, exclude={"tags", "attributes", "attachments"})
    if "type_id" in values and values["type_id"] is None:
        raise HTTPException(status_code=422, detail="type_id cannot be null.")
    for key, value in values.items():
        setattr(resource, key, value)
    resource.updated_by = user.id
    sync_metadata(db, resource.id, payload.tags, payload.attributes, payload.attachments, user.id)
    db.commit()
    db.refresh(resource)
    return serialize_resource(db, resource)


@router.delete("/{resource_id}", status_code=204)
def delete_resource(resource_id: int, db: Session = Depends(get_db), _: User = Depends(editor_only)):
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found.")
    db.delete(resource)
    db.commit()
