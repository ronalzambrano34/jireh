from __future__ import annotations

import argparse
import mimetypes
from dataclasses import dataclass
from pathlib import Path
import sys
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


@dataclass
class ReferenciaArchivo:

    tabla: str
    campo: str
    registro_id: int
    valor: str


FUENTES_ARCHIVOS = [
    ("archivos_pedido", "ruta_archivo"),
    ("pedidos", "comprobante_pago"),
    ("pedidos_efectivo", "documento_identidad_url"),
    ("pedidos_otros", "documento_identidad_url"),
    ("contactos", "documento_identidad_url"),
    ("metodos_pago", "imagen_url"),
    ("metodo_pago_cuentas", "qr_url"),
    ("operadores", "foto_url"),
    ("promociones", "imagen_url"),
]


def normalizar_valor(value: str | None):
    if not value:
        return ""
    return str(value).strip()


def es_url_externa(value: str):
    return value.startswith(("http://", "https://"))


def ruta_local_desde_valor(value: str, storage_dir: Path):
    value = value.strip()
    if value.startswith("/storage/"):
        return storage_dir / value.removeprefix("/storage/")
    if value.startswith("storage/"):
        return storage_dir / value.removeprefix("storage/")
    if value.startswith("/"):
        return None
    parsed = urlparse(value)
    if parsed.scheme:
        return None
    return storage_dir / value


def ruta_relativa_storage(value: str):
    value = value.strip()
    if value.startswith("/storage/"):
        return Path(value.removeprefix("/storage/"))
    if value.startswith("storage/"):
        return Path(value.removeprefix("storage/"))
    if value.startswith("/"):
        return None
    parsed = urlparse(value)
    if parsed.scheme:
        return None
    return Path(value)


def content_type_archivo(path: Path):
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def verificar_url(url: str):
    try:
        response = requests.head(
            url,
            allow_redirects=True,
            timeout=12,
        )
        if response.status_code == 405:
            response = requests.get(
                url,
                stream=True,
                timeout=12,
            )
        return 200 <= response.status_code < 400
    except requests.RequestException:
        return False


def recolectar_referencias(db):
    from sqlalchemy import inspect
    from sqlalchemy import text

    inspector = inspect(
        db.bind
    )
    referencias: list[ReferenciaArchivo] = []

    for tabla, campo in FUENTES_ARCHIVOS:
        if not inspector.has_table(
            tabla
        ):
            continue

        columnas = {
            column["name"]
            for column in inspector.get_columns(
                tabla
            )
        }
        if "id" not in columnas or campo not in columnas:
            continue

        rows = db.execute(
            text(
                f"""
                SELECT id, {campo} AS valor
                FROM {tabla}
                WHERE {campo} IS NOT NULL
                AND TRIM(CAST({campo} AS TEXT)) <> ''
                """
            )
        ).mappings()

        for row in rows:
            valor = normalizar_valor(
                row["valor"]
            )
            if not valor:
                continue
            referencias.append(
                ReferenciaArchivo(
                    tabla=tabla,
                    campo=campo,
                    registro_id=row["id"],
                    valor=valor,
                )
            )

    return referencias


def migrar_archivo_local(cache, local_path, relativa):
    from Backend.services.storage_service import guardar_upload_supabase

    cache_key = relativa.as_posix()
    if cache_key in cache:
        return cache[cache_key]

    destino = Path("migrados") / relativa
    url = guardar_upload_supabase(
        destino,
        content_type_archivo(local_path),
        local_path.read_bytes(),
        upsert=True,
    )
    cache[cache_key] = url
    return url


def auditar(args):
    from Backend.config import STORAGE_DIR
    from Backend.config import USE_SUPABASE_STORAGE
    from Backend.database import SessionLocal

    db = SessionLocal()
    cache_migracion: dict[str, str] = {}
    resumen = {
        "total": 0,
        "local_ok": 0,
        "local_perdido": 0,
        "externo_ok": 0,
        "externo_no_verificado": 0,
        "externo_error": 0,
        "migrado": 0,
    }

    try:
        referencias = recolectar_referencias(db)
        resumen["total"] = len(referencias)

        for referencia in referencias:
            valor = referencia.valor
            etiqueta = f"{referencia.tabla}.{referencia.campo}#{referencia.registro_id}"

            if es_url_externa(valor):
                if not args.verificar_remotos:
                    resumen["externo_no_verificado"] += 1
                    continue
                if verificar_url(valor):
                    resumen["externo_ok"] += 1
                    continue
                resumen["externo_error"] += 1
                print(f"ERROR_REMOTO | {etiqueta} | {valor}")
                continue

            local_path = ruta_local_desde_valor(
                valor,
                STORAGE_DIR
            )
            relativa = ruta_relativa_storage(
                valor
            )
            if not local_path or not relativa:
                resumen["local_perdido"] += 1
                print(f"NO_VERIFICABLE | {etiqueta} | {valor}")
                continue

            if not local_path.exists():
                resumen["local_perdido"] += 1
                print(f"PERDIDO | {etiqueta} | {valor} | falta {local_path}")
                continue

            resumen["local_ok"] += 1
            if args.resubir:
                if not USE_SUPABASE_STORAGE:
                    raise RuntimeError(
                        "USE_SUPABASE_STORAGE debe estar activo para re-subir archivos"
                    )

                url = migrar_archivo_local(
                    cache_migracion,
                    local_path,
                    relativa,
                )
                from sqlalchemy import text

                db.execute(
                    text(
                        f"""
                        UPDATE {referencia.tabla}
                        SET {referencia.campo} = :url
                        WHERE id = :id
                        """
                    ),
                    {
                        "url": url,
                        "id": referencia.registro_id,
                    }
                )
                resumen["migrado"] += 1
                print(f"MIGRADO | {etiqueta} | {valor} -> {url}")

        if args.resubir and args.aplicar:
            db.commit()
        elif args.resubir:
            db.rollback()
            print("DRY_RUN | usa --aplicar para guardar cambios")

    finally:
        db.close()

    print(
        "RESUMEN | "
        + " | ".join(
            f"{key}={value}"
            for key, value in resumen.items()
        )
    )

    if resumen["local_perdido"] or resumen["externo_error"]:
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Audita y re-sube referencias de fotos/archivos guardadas en la base."
    )
    parser.add_argument(
        "--verificar-remotos",
        action="store_true",
        help="Verifica tambien URLs http/https con HEAD/GET."
    )
    parser.add_argument(
        "--resubir",
        action="store_true",
        help="Sube archivos locales existentes a Supabase Storage."
    )
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Guarda en base las URLs migradas. Sin esto queda en dry-run."
    )
    args = parser.parse_args()
    raise SystemExit(
        auditar(args)
    )


if __name__ == "__main__":
    main()
