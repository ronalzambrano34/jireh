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
