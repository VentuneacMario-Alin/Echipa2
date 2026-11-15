from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import models
from .database import Base, SessionLocal, engine
from .models import Category, ResourceType
from .routers.auth_router import router as auth_router
from .routers.resources_router import router as resources_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        resource_types = (
            ("Echipament", "Aparatură și dispozitive de laborator"),
            ("Articol", "Articole științifice, lucrări, rapoarte"),
            ("Carte", "Cărți și capitole de carte"),
            ("Set de date", "Seturi de date folosite în cercetare"),
            ("Software", "Programe, biblioteci, licențe"),
            ("Spațiu", "Laboratoare, săli, spații de lucru"),
            ("Consumabil", "Materiale și reactivi"),
        )
        for name, description in resource_types:
            if db.scalar(select(ResourceType.id).where(ResourceType.name == name)) is None:
                db.add(ResourceType(name=name, description=description))

        root_categories = ("Medicină", "Calculatoare", "Informatică", "Biologie", "Chimie", "Fizică")
        for name in root_categories:
            if db.scalar(select(Category.id).where(Category.name == name, Category.parent_id.is_(None))) is None:
                db.add(Category(name=name))
        db.flush()

        subcategories = (
            ("Informatică", "Inteligență artificială"),
            ("Informatică", "Rețele"),
            ("Biologie", "Microbiologie"),
        )
        for parent_name, name in subcategories:
            parent_id = db.scalar(
                select(Category.id).where(Category.name == parent_name, Category.parent_id.is_(None))
            )
            if parent_id is not None and db.scalar(
                select(Category.id).where(Category.name == name, Category.parent_id == parent_id)
            ) is None:
                db.add(Category(name=name, parent_id=parent_id))
        db.commit()
    yield


app = FastAPI(
    title="Research Resource Manager API",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(auth_router, prefix="/auth")
app.include_router(resources_router)


@app.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.mount(
    "/",
    StaticFiles(directory=Path(__file__).resolve().parent.parent / "frontend", html=True),
    name="frontend",
)