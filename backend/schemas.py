from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="cititor", pattern="^(admin|editor|cititor)$")

    @model_validator(mode="after")
    def enforce_default_role(self):
        self.role = "cititor"
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool


class MessageResponse(BaseModel):
    message: str


ResourceStatus = Literal["disponibil", "in_utilizare", "mentenanta", "retras"]
AttachmentKind = Literal["link", "fisier"]
BookingStatus = Literal["pending", "confirmed", "cancelled", "completed", "active"]


class ResourceTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None


class ResourceTypeRead(ResourceTypeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    parent_id: int | None = None


class CategoryRead(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class AttachmentCreate(BaseModel):
    kind: AttachmentKind
    title: str | None = Field(default=None, max_length=200)
    url: str | None = None
    storage_path: str | None = None
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=100)
    size_bytes: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_payload(self):
        if self.kind == "link" and (not self.url or self.storage_path or self.file_name):
            raise ValueError("A link requires url and cannot contain file fields.")
        if self.kind == "fisier" and (not self.storage_path or not self.file_name or self.url):
            raise ValueError("A file requires storage_path and file_name and cannot contain url.")
        return self


class AttachmentRead(AttachmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    resource_id: int
    uploaded_by: int | None
    created_at: datetime


class ResourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    type_id: int
    category_id: int | None = None
    status: ResourceStatus = "disponibil"
    location: str | None = Field(default=None, max_length=200)
    identifier: str | None = Field(default=None, max_length=100)
    acquired_on: date | None = None
    owner_id: int | None = None
    tags: list[str] = Field(default_factory=list, max_length=30)
    attributes: dict[str, str] = Field(default_factory=dict)
    attachments: list[AttachmentCreate] = Field(default_factory=list, max_length=20)


class ResourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    type_id: int | None = None
    category_id: int | None = None
    status: ResourceStatus | None = None
    location: str | None = Field(default=None, max_length=200)
    identifier: str | None = Field(default=None, max_length=100)
    acquired_on: date | None = None
    owner_id: int | None = None
    tags: list[str] | None = Field(default=None, max_length=30)
    attributes: dict[str, str] | None = None
    attachments: list[AttachmentCreate] | None = Field(default=None, max_length=20)


class ResourceRead(BaseModel):
    id: int
    name: str
    description: str | None
    type_id: int
    type_name: str
    category_id: int | None
    category_name: str | None
    status: ResourceStatus
    location: str | None
    identifier: str | None
    acquired_on: date | None
    owner_id: int | None
    created_by: int | None
    updated_by: int | None
    created_at: datetime
    updated_at: datetime
    tags: list[str]
    attributes: dict[str, str]
    attachments: list[AttachmentRead]


class BookingCreate(BaseModel):
    start_at: datetime
    end_at: datetime
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_booking_window(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be later than start_at.")
        return self


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    user_id: int
    start_at: datetime
    end_at: datetime
    status: BookingStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime