import logging
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from .config import settings
from . import updates
from .routes import auth_routes, cards, classes, media, owner
from .seed import run_startup_seed

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_startup_seed()
    yield


app = FastAPI(
    title="Recapp API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.is_dev else None,
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def cache_control_for(path: str) -> str | None:
    """Hashed build files can stay cached. HTML must revalidate, or the browser
    keeps yesterday's page on bassaleo.xyz after a deploy."""
    if path.startswith("/api/"):
        return None
    if path.startswith("/assets/"):
        return "public, max-age=31536000, immutable"
    leaf = path.rsplit("/", 1)[-1]
    if path == "/" or leaf.endswith(".html") or "." not in leaf:
        return "no-cache"
    return None


def _origin_allowed(origin: str) -> bool:
    if not origin:
        return True
    host = urlparse(origin).netloc.lower()
    public = urlparse(settings.public_url).netloc.lower()
    allowed = {public, f"www.{public}", *settings.extra_hosts}
    if settings.is_dev:
        allowed |= {"localhost:5173", "127.0.0.1:5173", "localhost:8000", "127.0.0.1:8000"}
    return host in allowed


@app.middleware("http")
async def guard(request: Request, call_next):
    # Session cookies are SameSite=Lax; rejecting foreign Origins on writes closes
    # the remaining cross-site request paths.
    if request.method not in SAFE_METHODS and request.url.path.startswith("/api/"):
        if not _origin_allowed(request.headers.get("origin", "")):
            return JSONResponse({"detail": "Origine non consentita"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    caching = cache_control_for(request.url.path)
    if caching:
        response.headers["Cache-Control"] = caching
    return response


@app.get("/api/healthz")
def healthz():
    return {"ok": True, "env": settings.app_env, "ocr": settings.ocr_provider, "runner": settings.task_runner}


for module in (auth_routes, classes, cards, media, owner, updates):
    app.include_router(module.router)


@app.exception_handler(StarletteHTTPException)
async def not_found_to_spa(request: Request, exc: StarletteHTTPException):
    index = settings.web_dist / "index.html"
    if (
        exc.status_code == 404
        and request.method == "GET"
        and not request.url.path.startswith("/api/")
        and index.exists()
    ):
        return FileResponse(index)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


if settings.web_dist.exists():
    app.mount("/", StaticFiles(directory=settings.web_dist, html=True), name="web")
