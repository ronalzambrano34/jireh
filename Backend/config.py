from pathlib import Path

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

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
    "true"
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


GOOGLE_SHEET_ID = os.getenv(
    "GOOGLE_SHEET_ID"
)

GOOGLE_SHEET_WORKSHEET = os.getenv(
    "GOOGLE_SHEET_WORKSHEET",
    "Calcular Oferta"
)

GOOGLE_SHEET_RANGE = os.getenv(
    "GOOGLE_SHEET_RANGE",
    "A1:Z160"
)
