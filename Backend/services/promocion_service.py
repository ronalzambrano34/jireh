from datetime import datetime
from datetime import timezone
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from Backend.config import UPLOAD_MAX_BYTES
from Backend.config import STORAGE_DIR
from Backend.models.promocion import Promocion


def _normalizar_datetime(value: datetime):
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _validar_rango(fecha_desde: datetime, fecha_hasta: datetime):
    if fecha_hasta <= fecha_desde:
        raise Exception("fecha_hasta debe ser posterior a fecha_desde")


def deshabilitar_promociones_expiradas(db: Session):
    ahora = datetime.utcnow()
    expiradas = (
        db.query(Promocion)
        .filter(Promocion.activa == True, Promocion.fecha_hasta < ahora)
        .all()
    )

    if not expiradas:
        return 0

    for promocion in expiradas:
        promocion.activa = False
        promocion.updated_at = ahora

    db.commit()
    return len(expiradas)


def listar_promociones(db: Session, busqueda: str | None = None, incluir_inactivas: bool = False, solo_vigentes: bool = False, limit: int = 100, offset: int = 0):
    deshabilitar_promociones_expiradas(db)
    ahora = datetime.utcnow()

    query = db.query(Promocion)

    if solo_vigentes:
        query = query.filter(
            Promocion.activa == True,
            Promocion.fecha_desde <= ahora,
            Promocion.fecha_hasta >= ahora,
            Promocion.imagen_url != "",
        )
    elif not incluir_inactivas:
        query = query.filter(Promocion.activa == True)

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Promocion.descripcion.ilike(patron),
                Promocion.imagen_url.ilike(patron),
            )
        )

    limit_seguro = max(1, min(limit, 200))
    offset_seguro = max(offset, 0)

    return (
        query
        .order_by(Promocion.fecha_desde.asc(), Promocion.id.desc())
        .offset(offset_seguro)
        .limit(limit_seguro)
        .all()
    )


def listar_promociones_vigentes(db: Session, limit: int = 10):
    return listar_promociones(db, solo_vigentes=True, limit=limit)


def obtener_promocion(db: Session, promocion_id: int):
    deshabilitar_promociones_expiradas(db)
    promocion = db.query(Promocion).filter(Promocion.id == promocion_id).first()

    if not promocion:
        raise Exception("Promocion no encontrada")

    return promocion


def crear_promocion(db: Session, data):
    fecha_desde = _normalizar_datetime(data.fecha_desde)
    fecha_hasta = _normalizar_datetime(data.fecha_hasta)
    _validar_rango(fecha_desde, fecha_hasta)

    promocion = Promocion(
        imagen_url=data.imagen_url or "",
        descripcion=data.descripcion.strip(),
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        activa=data.activa,
    )

    if not promocion.descripcion:
        raise Exception("La descripcion es obligatoria")

    db.add(promocion)
    db.commit()
    db.refresh(promocion)
    return promocion


def actualizar_promocion(db: Session, promocion_id: int, data):
    promocion = obtener_promocion(db, promocion_id)
    cambios = data.model_dump(exclude_unset=True)

    fecha_desde = _normalizar_datetime(cambios.get("fecha_desde", promocion.fecha_desde))
    fecha_hasta = _normalizar_datetime(cambios.get("fecha_hasta", promocion.fecha_hasta))
    _validar_rango(fecha_desde, fecha_hasta)

    if "descripcion" in cambios and not str(cambios["descripcion"]).strip():
        raise Exception("La descripcion es obligatoria")

    for campo, valor in cambios.items():
        if campo in {"fecha_desde", "fecha_hasta"}:
            valor = _normalizar_datetime(valor)
        if campo == "descripcion" and valor is not None:
            valor = valor.strip()
        setattr(promocion, campo, valor)

    promocion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(promocion)
    return promocion


def eliminar_promocion(db: Session, promocion_id: int):
    promocion = obtener_promocion(db, promocion_id)
    promocion.activa = False
    promocion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(promocion)
    return promocion


def guardar_imagen_promocion(db: Session, promocion_id: int, archivo: UploadFile):
    promocion = obtener_promocion(db, promocion_id)

    if not archivo.filename:
        raise Exception("archivo es requerido")

    content_type = archivo.content_type or "application/octet-stream"
    if content_type not in UPLOAD_ALLOWED_MIME_TYPES or not content_type.startswith("image/"):
        raise Exception("Tipo de imagen no permitido")

    extension = Path(archivo.filename).suffix.lower() or ".img"
    nombre_seguro = str(uuid4()) + extension
    ruta_relativa = Path("promociones") / nombre_seguro
    carpeta = STORAGE_DIR / "promociones"
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = STORAGE_DIR / ruta_relativa

    total_bytes = 0
    try:
        with destino.open("wb") as fh:
            while True:
                chunk = archivo.file.read(1024 * 1024)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > UPLOAD_MAX_BYTES:
                    raise Exception("Archivo excede el tamano maximo permitido")

                fh.write(chunk)
    except Exception:
        if destino.exists():
            destino.unlink()
        raise

    promocion.imagen_url = "/" + str(Path("storage") / ruta_relativa).replace("\\", "/")
    promocion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(promocion)
    return promocion
