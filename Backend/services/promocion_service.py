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
from Backend.models.configuracion import Configuracion
from Backend.models.promocion import Promocion

TIPOS_PROMOCION = {"promocion", "precios", "marca"}


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
            or_(Promocion.tipo != "promocion", Promocion.imagen_url != ""),
        )
    elif not incluir_inactivas:
        query = query.filter(Promocion.activa == True)

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Promocion.descripcion.ilike(patron),
                Promocion.titulo.ilike(patron),
                Promocion.subtitulo.ilike(patron),
                Promocion.imagen_url.ilike(patron),
            )
        )

    limit_seguro = max(1, min(limit, 200))
    offset_seguro = max(offset, 0)

    return (
        query
        .order_by(Promocion.orden.asc(), Promocion.fecha_desde.asc(), Promocion.id.asc())
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

    tipo = data.tipo.strip().lower()
    if tipo not in TIPOS_PROMOCION:
        raise Exception("Tipo de slide no permitido")

    promocion = Promocion(
        tipo=tipo,
        titulo=data.titulo.strip(),
        subtitulo=data.subtitulo.strip(),
        imagen_url=data.imagen_url or "",
        descripcion=data.descripcion.strip(),
        orden=data.orden,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        activa=data.activa,
    )

    if not promocion.titulo:
        raise Exception("El titulo es obligatorio")

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

    tipo = str(cambios.get("tipo", promocion.tipo)).strip().lower()
    if tipo not in TIPOS_PROMOCION:
        raise Exception("Tipo de slide no permitido")
    if "titulo" in cambios and not str(cambios["titulo"]).strip():
        raise Exception("El titulo es obligatorio")
    imagen_url = cambios.get("imagen_url", promocion.imagen_url) or ""
    if tipo == "promocion" and not imagen_url:
        raise Exception("La imagen es obligatoria para una promocion")

    for campo, valor in cambios.items():
        if campo in {"fecha_desde", "fecha_hasta"}:
            valor = _normalizar_datetime(valor)
        if campo in {"tipo", "titulo", "subtitulo", "descripcion"} and valor is not None:
            valor = valor.strip()
        setattr(promocion, campo, valor)

    promocion.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(promocion)
    return promocion


def eliminar_promocion(db: Session, promocion_id: int):
    promocion = obtener_promocion(db, promocion_id)
    db.delete(promocion)
    db.commit()
    return promocion


def asegurar_slides_carrusel_default(db: Session):
    marker_key = "carousel_slides_seeded_v1"
    if db.query(Configuracion).filter(Configuracion.clave == marker_key).first():
        return

    fecha_desde = datetime(2020, 1, 1)
    fecha_hasta = datetime(2100, 1, 1)
    defaults = []
    if not db.query(Promocion).filter(Promocion.tipo == "precios").first():
        defaults.append(Promocion(
            tipo="precios",
            titulo="Precios destacados",
            subtitulo="Mas vendidos",
            descripcion="Selecciona una tasa y crea tu orden.",
            imagen_url="",
            orden=10,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            activa=True,
        ))
    if not db.query(Promocion).filter(Promocion.tipo == "marca").first():
        defaults.append(Promocion(
            tipo="marca",
            titulo="Remesas con control y confianza",
            subtitulo="El Jireh",
            descripcion="Tasas y servicios actualizados para operar con claridad.",
            imagen_url="",
            orden=20,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            activa=True,
        ))
    db.add_all(defaults)
    db.add(Configuracion(
        clave=marker_key,
        valor="true",
        editable=False,
        descripcion="Indica que los slides iniciales del carrusel ya fueron creados.",
    ))
    db.commit()


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
