from pathlib import Path

from dotenv import load_dotenv
import os
import re

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

IS_VERCEL = bool(os.getenv("VERCEL"))


def _env_bool(
    name: str,
    default: bool = False
):
    return os.getenv(
        name,
        "true" if default else "false"
    ).strip().lower() in {
        "1",
        "true",
        "yes",
        "si"
    }


APP_ENV = (
    os.getenv("APP_ENV")
    or os.getenv("ENVIRONMENT")
    or os.getenv("ENV")
    or ("production" if IS_VERCEL else "development")
).strip().lower()

IS_PRODUCTION = (
    IS_VERCEL
    or APP_ENV in {"prod", "production"}
    or bool(
        os.getenv("RENDER")
        or os.getenv("RAILWAY_ENVIRONMENT")
        or os.getenv("FLY_APP_NAME")
        or os.getenv("K_SERVICE")
        or os.getenv("HEROKU_APP_NAME")
    )
)

STORAGE_DIR = Path(
    os.getenv(
        "STORAGE_DIR",
        "/tmp/storage" if IS_VERCEL else "storage"
    )
)


def _normalizar_url_supabase(value: str | None) -> str:
    raw = (value or "").strip()
    getenv_match = re.fullmatch(
        r"""os\.getenv\(\s*["'](https?://[^"']+)["']\s*\)""",
        raw
    )
    if getenv_match:
        raw = getenv_match.group(1)

    return raw.strip("\"'").rstrip("/")


SUPABASE_URL = _normalizar_url_supabase(
    os.getenv("SUPABASE_URL")
)
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    ""
).strip()
SUPABASE_STORAGE_BUCKET = os.getenv(
    "SUPABASE_STORAGE_BUCKET",
    "comprobantes"
)
REQUIRE_EXTERNAL_STORAGE = _env_bool(
    "REQUIRE_EXTERNAL_STORAGE",
    IS_PRODUCTION
)
SUPABASE_STORAGE_REQUESTED = _env_bool(
    "USE_SUPABASE_STORAGE",
    REQUIRE_EXTERNAL_STORAGE
)
USE_SUPABASE_STORAGE = (
    SUPABASE_STORAGE_REQUESTED
    and bool(SUPABASE_URL)
    and bool(SUPABASE_SERVICE_ROLE_KEY)
)
LOCAL_STORAGE_ENABLED = (
    not REQUIRE_EXTERNAL_STORAGE
    and not USE_SUPABASE_STORAGE
)
STORAGE_BACKEND = (
    "supabase"
    if USE_SUPABASE_STORAGE
    else "local"
    if LOCAL_STORAGE_ENABLED
    else "missing"
)
LOG_LEVEL = os.getenv(
    "LOG_LEVEL",
    "INFO"
).strip().upper()
REQUEST_SLOW_MS = int(
    os.getenv(
        "REQUEST_SLOW_MS",
        "8000"
    )
)

DATABASE_URL = os.getenv(
    "DATABASE_URL"
)

TOKEN = os.getenv(
    "TOKEN"
)

PHONE_ID = os.getenv(
    "PHONE_ID"
)
AUTH_SECRET = os.getenv(
    "AUTH_SECRET"
) or TOKEN or "dev-secret-change-me"

AUTH_TOKEN_MINUTES = int(
    os.getenv(
        "AUTH_TOKEN_MINUTES",
        "720"
    )
)

FRONTEND_ORIGINS = list(dict.fromkeys([
    "https://ronalzambrano34.github.io",
    *[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173,*"
        ).split(",")
        if origin.strip()
    ],
]))

OPERADOR_ADMIN_NOMBRE = os.getenv(
    "OPERADOR_ADMIN_NOMBRE",
    "Ronal Zambrano Ferrer"
)

OPERADOR_ADMIN_TELEFONO = os.getenv(
    "OPERADOR_ADMIN_TELEFONO",
    "+5548991233191"
)

OPERADOR_ADMIN_PASSWORD = os.getenv(
    "OPERADOR_ADMIN_PASSWORD"
)

ENABLE_TEST_LOGIN = os.getenv(
    "ENABLE_TEST_LOGIN",
    "false"
).strip().lower() in {
    "1",
    "true",
    "yes",
    "si"
}

TEST_ADMIN_TELEFONO = os.getenv(
    "TEST_ADMIN_TELEFONO",
    "admin"
)

TEST_ADMIN_PASSWORD = os.getenv(
    "TEST_ADMIN_PASSWORD",
    "admin"
)


UPLOAD_MAX_BYTES = int(
    os.getenv(
        "UPLOAD_MAX_BYTES",
        str(
            5 * 1024 * 1024
        )
    )
)

UPLOAD_ALLOWED_MIME_TYPES = {
    mime.strip()
    for mime in os.getenv(
        "UPLOAD_ALLOWED_MIME_TYPES",
        "image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream"
    ).split(",")
    if mime.strip()
}

OFERTAS_AUTO_SYNC_ENABLED = os.getenv(
    "OFERTAS_AUTO_SYNC_ENABLED",
    "false" if IS_VERCEL else "true"
).strip().lower() in {
    "1",
    "true",
    "yes",
    "si"
}

OFERTAS_SYNC_INTERVAL_HOURS = float(
    os.getenv(
        "OFERTAS_SYNC_INTERVAL_HOURS",
        "12"
    )
)

OFERTAS_SYNC_START_DELAY_SECONDS = int(
    os.getenv(
        "OFERTAS_SYNC_START_DELAY_SECONDS",
        "15"
    )
)

RUN_DB_MAINTENANCE = os.getenv(
    "RUN_DB_MAINTENANCE",
    "true"
).strip().lower() in {
    "1",
    "true",
    "yes",
    "si"
}

RUN_DB_BOOTSTRAP = os.getenv(
    "RUN_DB_BOOTSTRAP",
    "false" if IS_VERCEL else "true"
).strip().lower() in {
    "1",
    "true",
    "yes",
    "si"
}


GOOGLE_SHEET_ID = os.getenv(
    "GOOGLE_SHEET_ID"
)

GOOGLE_CREDENTIALS_JSON = os.getenv(
    "GOOGLE_CREDENTIALS_JSON"
)

GOOGLE_CREDENTIALS_BASE64 = os.getenv(
    "GOOGLE_CREDENTIALS_BASE64"
)

GOOGLE_SHEET_WORKSHEET = os.getenv(
    "GOOGLE_SHEET_WORKSHEET",
    "Calcular Oferta"
)

GOOGLE_SHEET_RANGE = os.getenv(
    "GOOGLE_SHEET_RANGE",
    "A1:Z160"
)
