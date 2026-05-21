from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from Backend.config import UPLOAD_MAX_BYTES
from sqlalchemy.orm import Session

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.pedido import Pedido

from Backend.schemas.archivo_pedido import (
    ArchivoPedidoCreate,
    TIPOS_ARCHIVO_PEDIDO
)


def _obtener_pedido_por_codigo(
    db: Session,
    codigo_operacion: str
):
    pedido = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.codigo_operacion
            ==
            codigo_operacion
        )
        .first()
    )

    if not pedido:
        raise Exception(
            "Pedido no encontrado"
        )

    return pedido


def archivo_pedido_dict(
    archivo: ArchivoPedido
):
    return {
        "id": archivo.id,
        "pedido_id": archivo.pedido_id,
        "tipo": archivo.tipo,
        "ruta_archivo": archivo.ruta_archivo,
        "nombre_archivo": archivo.nombre_archivo,
        "mime_type": archivo.mime_type,
        "notas": archivo.notas,
        "usuario": archivo.usuario,
        "created_at": archivo.created_at,
    }


def listar_archivos_pedido(
    db: Session,
    codigo_operacion: str
):
    pedido = _obtener_pedido_por_codigo(
        db,
        codigo_operacion
    )

    archivos = (
        db.query(
            ArchivoPedido
        )
        .filter(
            ArchivoPedido.pedido_id
            ==
            pedido.id
        )
        .order_by(
            ArchivoPedido.created_at.desc(),
            ArchivoPedido.id.desc()
        )
        .all()
    )

    return [
        archivo_pedido_dict(
            archivo
        )
        for archivo in archivos
    ]


def registrar_archivo_pedido(
    db: Session,
    codigo_operacion: str,
    data: ArchivoPedidoCreate
):
    tipo = (
        data.tipo
        .strip()
        .lower()
    )

    if tipo not in TIPOS_ARCHIVO_PEDIDO:
        raise Exception(
            "Tipo de archivo no permitido. Use: "
            + ", ".join(
                sorted(
                    TIPOS_ARCHIVO_PEDIDO
                )
            )
        )

    ruta_archivo = (
        data.ruta_archivo
        .strip()
    )

    if not ruta_archivo:
        raise Exception(
            "ruta_archivo es requerido"
        )

    pedido = _obtener_pedido_por_codigo(
        db,
        codigo_operacion
    )

    archivo = ArchivoPedido(
        pedido_id=pedido.id,
        tipo=tipo,
        ruta_archivo=ruta_archivo,
        nombre_archivo=data.nombre_archivo,
        mime_type=data.mime_type,
        notas=data.notas,
        usuario=data.usuario
    )

    db.add(
        archivo
    )
    db.commit()
    db.refresh(
        archivo
    )

    if tipo == "comprobante_cliente":
        pedido.comprobante_pago = ruta_archivo
        db.commit()

    return archivo_pedido_dict(
        archivo
    )


def guardar_upload_pedido(
    db: Session,
    codigo_operacion: str,
    tipo: str,
    archivo: UploadFile,
    usuario: str | None = None,
    notas: str | None = None
):
    if not archivo.filename:
        raise Exception(
            "archivo es requerido"
        )

    content_type = archivo.content_type or "application/octet-stream"
    if content_type not in UPLOAD_ALLOWED_MIME_TYPES:
        raise Exception(
            "Tipo de archivo no permitido"
        )

    extension = Path(
        archivo.filename
    ).suffix.lower()
    nombre_seguro = (
        str(
            uuid4()
        )
        +
        extension
    )
    carpeta = Path(
        "storage"
    ) / "pedidos" / codigo_operacion
    carpeta.mkdir(
        parents=True,
        exist_ok=True
    )
    destino = carpeta / nombre_seguro

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

    data = ArchivoPedidoCreate(
        tipo=tipo,
        ruta_archivo=str(
            destino
        ),
        nombre_archivo=archivo.filename,
        mime_type=content_type,
        notas=notas,
        usuario=usuario
    )

    return registrar_archivo_pedido(
        db,
        codigo_operacion,
        data
    )
