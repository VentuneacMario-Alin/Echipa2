from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import models
from .database import Base, engine
from .routers.auth_router import router as auth_router
from .routers.resources_router import router as resources_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
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