from pathlib import Path
from urllib.parse import quote

from fastapi import UploadFile
import requests

from Backend.config import LOCAL_STORAGE_ENABLED
from Backend.config import REQUIRE_EXTERNAL_STORAGE
from Backend.config import STORAGE_DIR
from Backend.config import SUPABASE_SERVICE_ROLE_KEY
from Backend.config import SUPABASE_STORAGE_BUCKET
from Backend.config import SUPABASE_URL
from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from Backend.config import UPLOAD_MAX_BYTES
from Backend.config import USE_SUPABASE_STORAGE


_supabase_bucket_ready = False


def detalle_error_supabase(response: requests.Response):
    try:
        data = response.json()
    except ValueError:
        return response.text.strip()[:300]

    return (
        data.get("message")
        or data.get("error")
        or str(data)
    )


def validar_configuracion_supabase():
    if not SUPABASE_URL.startswith(("http://", "https://")):
        raise Exception(
            "SUPABASE_URL no es valida. Debe contener la URL https://... del proyecto"
        )

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise Exception(
            "SUPABASE_SERVICE_ROLE_KEY no esta configurada"
        )

    if SUPABASE_SERVICE_ROLE_KEY.startswith("sb_service_role_"):
        raise Exception(
            "SUPABASE_SERVICE_ROLE_KEY no es valida: Supabase no emite claves "
            "con prefijo sb_service_role_. Configura la clave secreta real "
            "sb_secret_... o la service_role JWT legacy"
        )

    if SUPABASE_SERVICE_ROLE_KEY.startswith("sb_publishable_"):
        raise Exception(
            "SUPABASE_SERVICE_ROLE_KEY no puede usar una clave publicable. "
            "Configura la clave secreta sb_secret_... o la service_role JWT legacy"
        )

    if (
        not SUPABASE_SERVICE_ROLE_KEY.startswith("sb_secret_")
        and SUPABASE_SERVICE_ROLE_KEY.count(".") != 2
    ):
        raise Exception(
            "SUPABASE_SERVICE_ROLE_KEY tiene un formato desconocido. "
            "Configura la clave secreta sb_secret_... o la service_role JWT legacy"
        )


def validar_storage_produccion():
    if not REQUIRE_EXTERNAL_STORAGE or USE_SUPABASE_STORAGE:
        return

    validar_configuracion_supabase()
    raise Exception(
        "Storage externo obligatorio en produccion. Activa USE_SUPABASE_STORAGE=true."
    )


def headers_supabase(content_type: str):
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": content_type,
    }
    if SUPABASE_SERVICE_ROLE_KEY.count(".") == 2:
        headers["Authorization"] = f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    return headers


def leer_upload(archivo: UploadFile):
    contenido = bytearray()

    while True:
        chunk = archivo.file.read(1024 * 1024)
        if not chunk:
            break

        contenido.extend(chunk)
        if len(contenido) > UPLOAD_MAX_BYTES:
            raise Exception(
                "Archivo excede el tamano maximo permitido"
            )

    return bytes(contenido)


def asegurar_bucket_supabase():
    global _supabase_bucket_ready
    if _supabase_bucket_ready:
        return

    validar_configuracion_supabase()
    bucket = quote(
        SUPABASE_STORAGE_BUCKET,
        safe=""
    )
    headers = headers_supabase("application/json")
    try:
        consulta = requests.get(
            f"{SUPABASE_URL}/storage/v1/bucket/{bucket}",
            headers=headers,
            timeout=15,
        )
    except requests.RequestException as exc:
        raise Exception(
            "No se pudo conectar con Supabase Storage"
        ) from exc

    if consulta.status_code == 200:
        _supabase_bucket_ready = True
        return
    if consulta.status_code not in {400, 404}:
        raise Exception(
            "No se pudo consultar Supabase Storage: "
            + detalle_error_supabase(consulta)
        )

    try:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/bucket",
            headers=headers,
            json={
                "id": SUPABASE_STORAGE_BUCKET,
                "name": SUPABASE_STORAGE_BUCKET,
                "public": True,
                "file_size_limit": UPLOAD_MAX_BYTES,
                "allowed_mime_types": sorted(UPLOAD_ALLOWED_MIME_TYPES),
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        raise Exception(
            "No se pudo conectar con Supabase Storage"
        ) from exc

    if response.status_code not in {200, 201}:
        raise Exception(
            "No se pudo preparar Supabase Storage: "
            + detalle_error_supabase(response)
        )

    _supabase_bucket_ready = True


def guardar_upload_supabase(
    ruta_relativa: Path,
    content_type: str,
    contenido: bytes,
    upsert: bool = False,
):
    asegurar_bucket_supabase()
    ruta = quote(
        ruta_relativa.as_posix(),
        safe="/"
    )
    bucket = quote(
        SUPABASE_STORAGE_BUCKET,
        safe=""
    )
    try:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{ruta}",
            headers={
                **headers_supabase(content_type),
                "x-upsert": "true" if upsert else "false",
            },
            data=contenido,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise Exception(
            "No se pudo conectar con Supabase Storage"
        ) from exc

    if response.status_code not in {200, 201}:
        raise Exception(
            "No se pudo guardar el archivo en Supabase: "
            + detalle_error_supabase(response)
        )

    return (
        f"{SUPABASE_URL}/storage/v1/object/public/"
        f"{bucket}/{ruta}"
    )


def guardar_upload_persistente(
    archivo: UploadFile,
    ruta_relativa: Path,
    content_type: str,
):
    contenido = leer_upload(
        archivo
    )

    if USE_SUPABASE_STORAGE:
        return guardar_upload_supabase(
            ruta_relativa,
            content_type,
            contenido
        )

    validar_storage_produccion()

    if not LOCAL_STORAGE_ENABLED:
        raise Exception(
            "Storage local deshabilitado. Configura Supabase Storage para guardar archivos."
        )

    destino = STORAGE_DIR / ruta_relativa
    destino.parent.mkdir(
        parents=True,
        exist_ok=True
    )
    try:
        destino.write_bytes(
            contenido
        )
    except Exception:
        if destino.exists():
            destino.unlink()
        raise

    return (
        "/"
        + str(Path("storage") / ruta_relativa).replace("\\", "/")
    )
