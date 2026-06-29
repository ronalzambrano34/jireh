from __future__ import annotations

import argparse
from datetime import UTC
from datetime import datetime
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile

import requests
from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def ahora_tag():
    return datetime.now(
        UTC
    ).strftime("%Y%m%d-%H%M%S")


def json_default(value):
    if isinstance(
        value,
        datetime
    ):
        return value.isoformat()
    if isinstance(
        value,
        bytes
    ):
        return value.hex()
    return str(
        value
    )


def asegurar_dir(path: Path):
    path.mkdir(
        parents=True,
        exist_ok=True
    )
    return path


def sqlite_path(database_url: str):
    url = make_url(
        database_url
    )
    if url.drivername != "sqlite":
        return None
    if not url.database or url.database == ":memory:":
        return None
    return Path(
        url.database
    )


def backup_sqlite(database_url: str, out_dir: Path, tag: str):
    path = sqlite_path(
        database_url
    )
    if not path or not path.exists():
        return None

    destino = out_dir / f"db-{tag}.sqlite3"
    conexion_origen = sqlite3.connect(
        path
    )
    conexion_destino = sqlite3.connect(
        destino
    )
    try:
        conexion_origen.backup(
            conexion_destino
        )
    finally:
        conexion_destino.close()
        conexion_origen.close()
    return destino


def backup_postgres_pg_dump(database_url: str, out_dir: Path, tag: str):
    pg_dump = shutil.which(
        "pg_dump"
    )
    if not pg_dump:
        return None

    destino = out_dir / f"db-{tag}.dump"
    subprocess.run(
        [
            pg_dump,
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            "--file",
            str(
                destino
            ),
            database_url,
        ],
        check=True,
        timeout=300,
    )
    return destino


def backup_db_jsonl(database_url: str, out_dir: Path, tag: str):
    destino = out_dir / f"db-logical-{tag}.jsonl"
    engine = create_engine(
        database_url,
        pool_pre_ping=True
    )
    total = 0

    with engine.connect() as conn, destino.open(
        "w",
        encoding="utf-8"
    ) as handle:
        inspector = inspect(
            conn
        )
        for table_name in sorted(
            inspector.get_table_names()
        ):
            rows = conn.execute(
                text(
                    f'SELECT * FROM "{table_name}"'
                )
            ).mappings()
            for row in rows:
                handle.write(
                    json.dumps(
                        {
                            "table": table_name,
                            "row": dict(
                                row
                            ),
                        },
                        default=json_default,
                        ensure_ascii=True,
                    )
                    + "\n"
                )
                total += 1

    return destino, total


def backup_database(database_url: str, out_dir: Path, tag: str):
    sqlite_backup = backup_sqlite(
        database_url,
        out_dir,
        tag
    )
    if sqlite_backup:
        return {
            "tipo": "sqlite",
            "archivo": str(
                sqlite_backup
            ),
        }

    pg_backup = backup_postgres_pg_dump(
        database_url,
        out_dir,
        tag
    )
    if pg_backup:
        return {
            "tipo": "postgres_pg_dump",
            "archivo": str(
                pg_backup
            ),
        }

    logical_backup, total = backup_db_jsonl(
        database_url,
        out_dir,
        tag
    )
    return {
        "tipo": "logical_jsonl",
        "archivo": str(
            logical_backup
        ),
        "filas": total,
        "nota": "Instala pg_dump para backup fisico/custom de PostgreSQL.",
    }


def backup_storage_local(storage_dir: Path, out_dir: Path, tag: str):
    destino = out_dir / f"storage-{tag}.tar.gz"
    total = 0

    with tarfile.open(
        destino,
        "w:gz"
    ) as tar:
        if storage_dir.exists():
            for path in sorted(
                storage_dir.rglob("*")
            ):
                if not path.is_file():
                    continue
                tar.add(
                    path,
                    arcname=Path("storage") / path.relative_to(
                        storage_dir
                    )
                )
                total += 1

    return {
        "tipo": "local",
        "archivo": str(
            destino
        ),
        "archivos": total,
    }


def listar_supabase(prefix: str = ""):
    from Backend.config import SUPABASE_STORAGE_BUCKET
    from Backend.config import SUPABASE_URL
    from Backend.services.storage_service import headers_supabase

    bucket = SUPABASE_STORAGE_BUCKET
    objetos = []
    offset = 0

    while True:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
            headers=headers_supabase(
                "application/json"
            ),
            json={
                "prefix": prefix,
                "limit": 1000,
                "offset": offset,
                "sortBy": {
                    "column": "name",
                    "order": "asc"
                }
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        if not data:
            break

        for item in data:
            name = item.get(
                "name"
            )
            if not name:
                continue
            full_name = f"{prefix}/{name}" if prefix else name
            if item.get("metadata") is None and item.get("id") is None:
                objetos.extend(
                    listar_supabase(
                        full_name
                    )
                )
            else:
                objetos.append(
                    full_name
                )

        if len(data) < 1000:
            break
        offset += len(
            data
        )

    return objetos


def backup_storage_supabase(out_dir: Path, tag: str):
    from Backend.config import SUPABASE_STORAGE_BUCKET
    from Backend.config import SUPABASE_URL
    from Backend.services.storage_service import headers_supabase

    bucket = SUPABASE_STORAGE_BUCKET
    destino = out_dir / f"supabase-storage-{tag}.tar.gz"
    objetos = listar_supabase()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(
            tmp_dir
        )
        for object_name in objetos:
            response = requests.get(
                f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_name}",
                headers=headers_supabase(
                    "application/octet-stream"
                ),
                timeout=60,
            )
            response.raise_for_status()
            destino_objeto = tmp_path / object_name
            destino_objeto.parent.mkdir(
                parents=True,
                exist_ok=True
            )
            destino_objeto.write_bytes(
                response.content
            )

        with tarfile.open(
            destino,
            "w:gz"
        ) as tar:
            for path in sorted(
                tmp_path.rglob("*")
            ):
                if path.is_file():
                    tar.add(
                        path,
                        arcname=Path("storage") / path.relative_to(
                            tmp_path
                        )
                    )

    return {
        "tipo": "supabase",
        "archivo": str(
            destino
        ),
        "archivos": len(
            objetos
        ),
    }


def backup_storage(out_dir: Path, tag: str):
    from Backend.config import LOCAL_STORAGE_ENABLED
    from Backend.config import STORAGE_DIR
    from Backend.config import USE_SUPABASE_STORAGE

    if USE_SUPABASE_STORAGE:
        return backup_storage_supabase(
            out_dir,
            tag
        )
    if LOCAL_STORAGE_ENABLED:
        return backup_storage_local(
            STORAGE_DIR,
            out_dir,
            tag
        )
    return {
        "tipo": "sin_storage_configurado",
        "archivo": None,
        "archivos": 0,
    }


def escribir_manifest(out_dir: Path, tag: str, database, storage):
    manifest = {
        "fecha_utc": datetime.now(
            UTC
        ).isoformat(),
        "tag": tag,
        "database": database,
        "storage": storage,
    }
    destino = out_dir / f"manifest-{tag}.json"
    destino.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=True
        ),
        encoding="utf-8"
    )
    return destino


def ejecutar_backup(out_dir: Path | None = None):
    from Backend.config import DATABASE_URL

    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL no esta configurada"
        )

    tag = ahora_tag()
    backup_dir = asegurar_dir(
        out_dir or ROOT / "backups" / tag
    )
    database = backup_database(
        DATABASE_URL,
        backup_dir,
        tag
    )
    storage = backup_storage(
        backup_dir,
        tag
    )
    manifest = escribir_manifest(
        backup_dir,
        tag,
        database,
        storage
    )
    return manifest


def self_test():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(
            tmp_dir
        )
        db_path = tmp_path / "test.sqlite3"
        storage_dir = tmp_path / "storage"
        out_dir = tmp_path / "backups"

        conn = sqlite3.connect(
            db_path
        )
        try:
            conn.execute(
                "CREATE TABLE prueba (id INTEGER PRIMARY KEY, nombre TEXT)"
            )
            conn.execute(
                "INSERT INTO prueba (nombre) VALUES ('ok')"
            )
            conn.commit()
        finally:
            conn.close()

        archivo = storage_dir / "pedidos" / "demo.txt"
        archivo.parent.mkdir(
            parents=True,
            exist_ok=True
        )
        archivo.write_text(
            "ok",
            encoding="utf-8"
        )

        tag = "selftest"
        database = backup_database(
            f"sqlite:///{db_path}",
            asegurar_dir(
                out_dir
            ),
            tag
        )
        storage = backup_storage_local(
            storage_dir,
            out_dir,
            tag
        )
        manifest = escribir_manifest(
            out_dir,
            tag,
            database,
            storage
        )

        assert Path(database["archivo"]).exists()
        assert Path(storage["archivo"]).exists()
        assert manifest.exists()

        with tarfile.open(
            storage["archivo"],
            "r:gz"
        ) as tar:
            assert "storage/pedidos/demo.txt" in tar.getnames()

    print("OK: backup self-test completado")


def main():
    parser = argparse.ArgumentParser(
        description="Genera backup operativo de base de datos y storage."
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Directorio destino. Por defecto usa backups/<fecha>."
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Prueba backup con SQLite y storage temporales."
    )
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    manifest = ejecutar_backup(
        args.out_dir
    )
    print(
        f"OK: backup creado {manifest}"
    )


if __name__ == "__main__":
    main()
