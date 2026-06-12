from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from Backend.config import STORAGE_DIR
from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from Backend.config import UPLOAD_MAX_BYTES
from sqlalchemy import or_
from sqlalchemy.orm import Session

from Backend.models.metodo_pago import (
    MetodoPago
)
from Backend.models.metodo_pago_cuenta import (
    MetodoPagoCuenta
)


def _normalizar_moneda(
    moneda: str | None
):

    if moneda is None or not str(moneda).strip():
        raise Exception(
            "La moneda es obligatoria"
        )

    return str(
        moneda
    ).strip().upper()


def listar_metodos_pago(
    db: Session,
    moneda: str | None = None,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0
):

    query = db.query(
        MetodoPago
    )

    if not incluir_inactivos:
        query = query.filter(
            MetodoPago.activo
            == True
        )

    if moneda:
        query = query.filter(
            MetodoPago.moneda
            == _normalizar_moneda(
                moneda
            )
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                MetodoPago.nombre.ilike(
                    patron
                ),
                MetodoPago.moneda.ilike(
                    patron
                )
            )
        )

    limit_seguro = max(
        1,
        min(
            limit,
            200
        )
    )
    offset_seguro = max(
        offset,
        0
    )

    return (
        query
        .order_by(
            MetodoPago.moneda.asc(),
            MetodoPago.nombre.asc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )


def obtener_metodo_pago(
    db: Session,
    metodo_id: int
):

    metodo = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.id
            == metodo_id
        )
        .first()
    )

    if not metodo:
        raise Exception(
            "Metodo de pago no encontrado"
        )

    return metodo


def crear_metodo_pago(
    db: Session,
    data
):

    moneda = _normalizar_moneda(
        data.moneda
    )

    existe = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.nombre
            == data.nombre,
            MetodoPago.moneda
            == moneda
        )
        .first()
    )

    if existe:
        raise Exception(
            "El metodo de pago ya existe"
        )

    metodo = MetodoPago(
        nombre=data.nombre,
        moneda=moneda,
        imagen_url=data.imagen_url
    )

    db.add(
        metodo
    )
    db.commit()
    db.refresh(
        metodo
    )

    return metodo


def actualizar_metodo_pago(
    db: Session,
    metodo_id: int,
    data
):

    metodo = obtener_metodo_pago(
        db,
        metodo_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    if "moneda" in cambios:
        cambios["moneda"] = _normalizar_moneda(
            cambios["moneda"]
        )

    nombre = cambios.get(
        "nombre",
        metodo.nombre
    )
    moneda = cambios.get(
        "moneda",
        metodo.moneda
    )

    if "nombre" in cambios or "moneda" in cambios:
        existe = (
            db.query(
                MetodoPago
            )
            .filter(
                MetodoPago.nombre
                == nombre,
                MetodoPago.moneda
                == moneda,
                MetodoPago.id
                != metodo.id
            )
            .first()
        )

        if existe:
            raise Exception(
                "El metodo de pago ya existe"
            )

    for campo, valor in cambios.items():
        setattr(
            metodo,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        metodo
    )

    return metodo


def eliminar_metodo_pago(
    db: Session,
    metodo_id: int
):

    metodo = obtener_metodo_pago(
        db,
        metodo_id
    )

    metodo.activo = False

    db.commit()
    db.refresh(
        metodo
    )

    return metodo


def guardar_imagen_metodo_pago(
    db: Session,
    metodo_id: int,
    archivo: UploadFile
):
    metodo = obtener_metodo_pago(
        db,
        metodo_id
    )

    if not archivo.filename:
        raise Exception(
            "archivo es requerido"
        )

    content_type = archivo.content_type or "application/octet-stream"
    if content_type not in UPLOAD_ALLOWED_MIME_TYPES or not content_type.startswith("image/"):
        raise Exception(
            "Tipo de imagen no permitido"
        )

    extension = Path(
        archivo.filename
    ).suffix.lower() or ".img"
    nombre_seguro = (
        str(
            uuid4()
        )
        + extension
    )
    ruta_relativa = Path("metodos-pago") / nombre_seguro
    carpeta = STORAGE_DIR / "metodos-pago"
    carpeta.mkdir(
        parents=True,
        exist_ok=True
    )
    destino = STORAGE_DIR / ruta_relativa

    total_bytes = 0
    try:
        with destino.open(
            "wb"
        ) as fh:
            while True:
                chunk = archivo.file.read(
                    1024 * 1024
                )
                if not chunk:
                    break

                total_bytes += len(
                    chunk
                )
                if total_bytes > UPLOAD_MAX_BYTES:
                    raise Exception(
                        "Archivo excede el tamano maximo permitido"
                    )

                fh.write(
                    chunk
                )
    except Exception:
        if destino.exists():
            destino.unlink()
        raise

    metodo.imagen_url = "/" + str(
        Path("storage") / ruta_relativa
    ).replace("\\", "/")
    db.commit()
    db.refresh(
        metodo
    )

    return metodo



def listar_cuentas_metodo_pago(
    db: Session,
    metodo_id: int,
    incluir_inactivas: bool = True
):
    obtener_metodo_pago(
        db,
        metodo_id
    )

    query = db.query(
        MetodoPagoCuenta
    ).filter(
        MetodoPagoCuenta.metodo_pago_id == metodo_id
    )

    if not incluir_inactivas:
        query = query.filter(
            MetodoPagoCuenta.activa == True
        )

    return (
        query.order_by(
            MetodoPagoCuenta.predeterminada.desc(),
            MetodoPagoCuenta.alias.asc()
        ).all()
    )


def _limpiar_predeterminadas(
    db: Session,
    metodo_id: int,
    cuenta_id: int | None = None
):
    query = db.query(
        MetodoPagoCuenta
    ).filter(
        MetodoPagoCuenta.metodo_pago_id == metodo_id
    )

    if cuenta_id is not None:
        query = query.filter(
            MetodoPagoCuenta.id != cuenta_id
        )

    query.update(
        {MetodoPagoCuenta.predeterminada: False},
        synchronize_session=False
    )


def crear_cuenta_metodo_pago(
    db: Session,
    metodo_id: int,
    data
):
    obtener_metodo_pago(
        db,
        metodo_id
    )

    cuenta = MetodoPagoCuenta(
        metodo_pago_id=metodo_id,
        alias=data.alias.strip(),
        cuenta=data.cuenta.strip(),
        titular=data.titular.strip(),
        qr_url=(data.qr_url or None),
        predeterminada=bool(data.predeterminada),
        activa=bool(data.activa),
    )

    if cuenta.predeterminada:
        _limpiar_predeterminadas(
            db,
            metodo_id
        )

    db.add(
        cuenta
    )
    db.commit()
    db.refresh(
        cuenta
    )

    return cuenta


def obtener_cuenta_metodo_pago(
    db: Session,
    metodo_id: int,
    cuenta_id: int
):
    cuenta = (
        db.query(
            MetodoPagoCuenta
        )
        .filter(
            MetodoPagoCuenta.id == cuenta_id,
            MetodoPagoCuenta.metodo_pago_id == metodo_id
        )
        .first()
    )

    if not cuenta:
        raise Exception(
            "Cuenta del metodo de pago no encontrada"
        )

    return cuenta


def actualizar_cuenta_metodo_pago(
    db: Session,
    metodo_id: int,
    cuenta_id: int,
    data
):
    cuenta = obtener_cuenta_metodo_pago(
        db,
        metodo_id,
        cuenta_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    if cambios.get(
        "predeterminada"
    ) is True:
        _limpiar_predeterminadas(
            db,
            metodo_id,
            cuenta_id=cuenta.id
        )

    for campo, valor in cambios.items():
        if isinstance(
            valor,
            str
        ):
            valor = valor.strip()
        setattr(
            cuenta,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        cuenta
    )

    return cuenta


def eliminar_cuenta_metodo_pago(
    db: Session,
    metodo_id: int,
    cuenta_id: int
):
    cuenta = obtener_cuenta_metodo_pago(
        db,
        metodo_id,
        cuenta_id
    )
    cuenta.activa = False
    if cuenta.predeterminada:
        cuenta.predeterminada = False

    db.commit()
    db.refresh(
        cuenta
    )

    return cuenta


def obtener_cuenta_predeterminada_metodo_pago(
    db: Session,
    metodo_id: int
):
    return (
        db.query(
            MetodoPagoCuenta
        )
        .filter(
            MetodoPagoCuenta.metodo_pago_id == metodo_id,
            MetodoPagoCuenta.activa == True
        )
        .order_by(
            MetodoPagoCuenta.predeterminada.desc(),
            MetodoPagoCuenta.id.asc()
        )
        .first()
    )
