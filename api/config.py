import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

TZ = ZoneInfo("Europe/Rome")


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    app_env: str
    public_url: str
    secret_key: str
    database_url: str
    owner_username: str
    owner_password: str
    owner_display_name: str
    ocr_provider: str
    featherless_api_key: str
    featherless_model: str
    featherless_text_model: str
    task_runner: str
    render_api_key: str
    render_workflow_task: str
    web_dist: Path
    extra_hosts: tuple[str, ...]

    @property
    def is_dev(self) -> bool:
        return self.app_env != "prod"

    @property
    def secure_cookies(self) -> bool:
        return self.public_url.startswith("https://")


def load_settings() -> Settings:
    app_env = _env("APP_ENV", "dev")
    secret = _env("SECRET_KEY")
    if not secret:
        if app_env == "prod":
            raise RuntimeError("SECRET_KEY is required when APP_ENV=prod")
        # Keep dev sessions valid across auto-reloads.
        dev_secret = ROOT / ".dev_secret"
        if not dev_secret.exists():
            dev_secret.write_text(secrets.token_urlsafe(48))
        secret = dev_secret.read_text().strip()
    return Settings(
        app_env=app_env,
        public_url=_env("PUBLIC_URL", "http://localhost:5173").rstrip("/"),
        secret_key=secret,
        database_url=_env("DATABASE_URL", f"sqlite:///{ROOT / 'ieri.db'}"),
        owner_username=_env("OWNER_USERNAME", "preside" if app_env != "prod" else ""),
        owner_password=_env("OWNER_PASSWORD", "demo" if app_env != "prod" else ""),
        owner_display_name=_env("OWNER_DISPLAY_NAME", "Dirigenza"),
        ocr_provider=_env("OCR_PROVIDER", "mock"),
        featherless_api_key=_env("FEATHERLESS_API_KEY"),
        featherless_model=_env("FEATHERLESS_MODEL"),
        featherless_text_model=_env("FEATHERLESS_TEXT_MODEL"),
        task_runner=_env("TASK_RUNNER", "inline"),
        render_api_key=_env("RENDER_API_KEY"),
        render_workflow_task=_env("RENDER_WORKFLOW_TASK"),
        web_dist=Path(_env("WEB_DIST", str(ROOT / "web" / "dist"))),
        # Render sets RENDER_EXTERNAL_HOSTNAME (e.g. ieri.onrender.com); EXTRA_HOSTS is comma-separated.
        extra_hosts=tuple(
            h.strip().lower()
            for h in [_env("RENDER_EXTERNAL_HOSTNAME"), *_env("EXTRA_HOSTS").split(",")]
            if h.strip()
        ),
    )


settings = load_settings()
