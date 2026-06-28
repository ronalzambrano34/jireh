from pathlib import Path
from uuid import uuid4
from datetime import datetime, timedelta
import logging

from fastapi import UploadFile

from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from sqlalchemy.orm import Session

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.pedido_historial import PedidoHistorial
from Backend.models.pedido import Pedido
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_otros import PedidoOtros
from Backend.models.operador import Operador

from Backend.schemas.archivo_pedido import (
    ArchivoPedidoCreate,
    TIPOS_ARCHIVO_PEDIDO
)
from Backend.services.pedido_service import validar_bloqueo_pedido
from Backend.services.storage_service import guardar_upload_persistente

logger = logging.getLogger("jireh.archivos")
ARCHIVO_DEDUPE_SECONDS = 300


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


def _descripcion_archivo(
    tipo: str
):
    labels = {
        "comprobante_cliente": "Comprobante de cliente adjuntado",
        "documento_identidad": "Documento de identidad adjuntado",
        "comprobante_final": "Comprobante final adjuntado",
    }
    return labels.get(
        tipo,
        "Archivo adjuntado"
    )


def _aplicar_referencia_archivo(
    db: Session,
    pedido: Pedido,
    tipo: str,
    ruta_archivo: str
):
    if tipo == "comprobante_cliente":
        pedido.comprobante_pago = ruta_archivo

    if tipo == "documento_identidad":
        detalle_efectivo = (
            db.query(PedidoEfectivo)
            .filter(PedidoEfectivo.pedido_id == pedido.id)
            .first()
        )
        if detalle_efectivo:
            detalle_efectivo.documento_identidad_url = ruta_archivo

        detalle_otros = (
            db.query(PedidoOtros)
            .filter(PedidoOtros.pedido_id == pedido.id)
            .first()
        )
        if detalle_otros:
            detalle_otros.documento_identidad_url = ruta_archivo


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
    data: ArchivoPedidoCreate,
    operador: Operador | None = None
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
    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )

    archivo_existente = (
        db.query(
            ArchivoPedido
        )
        .filter(
            ArchivoPedido.pedido_id == pedido.id,
            ArchivoPedido.tipo == tipo,
            ArchivoPedido.ruta_archivo == ruta_archivo
        )
        .order_by(
            ArchivoPedido.id.desc()
        )
        .first()
    )

    if archivo_existente:
        _aplicar_referencia_archivo(
            db,
            pedido,
            tipo,
            ruta_archivo
        )
        db.commit()
        db.refresh(
            archivo_existente
        )
        logger.info(
            "archivo_pedido.registrar.repetido codigo=%s pedido_id=%s tipo=%s archivo_id=%s usuario=%s",
            codigo_operacion,
            pedido.id,
            tipo,
            archivo_existente.id,
            operador.nombre if operador else data.usuario
        )
        return archivo_pedido_dict(
            archivo_existente
        )

    if data.nombre_archivo:
        limite = datetime.utcnow() - timedelta(seconds=ARCHIVO_DEDUPE_SECONDS)
        archivo_reciente = (
            db.query(
                ArchivoPedido
            )
            .filter(
                ArchivoPedido.pedido_id == pedido.id,
                ArchivoPedido.tipo == tipo,
                ArchivoPedido.nombre_archivo == data.nombre_archivo,
                ArchivoPedido.mime_type == data.mime_type,
                ArchivoPedido.created_at >= limite
            )
            .order_by(
                ArchivoPedido.id.desc()
            )
            .first()
        )

        if archivo_reciente:
            _aplicar_referencia_archivo(
                db,
                pedido,
                tipo,
                archivo_reciente.ruta_archivo
            )
            db.commit()
            db.refresh(
                archivo_reciente
            )
            logger.info(
                "archivo_pedido.registrar.repetido_reciente codigo=%s pedido_id=%s tipo=%s archivo_id=%s usuario=%s",
                codigo_operacion,
                pedido.id,
                tipo,
                archivo_reciente.id,
                operador.nombre if operador else data.usuario
            )
            return archivo_pedido_dict(
                archivo_reciente
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
    db.flush()

    _aplicar_referencia_archivo(
        db,
        pedido,
        tipo,
        ruta_archivo
    )

    db.add(
        PedidoHistorial(
            pedido_id=pedido.id,
            estado_anterior=pedido.estado,
            estado_nuevo=pedido.estado,
            usuario=(operador.nombre if operador else data.usuario),
            comentario=_descripcion_archivo(tipo)
        )
    )

    db.commit()
    db.refresh(
        archivo
    )
    logger.info(
        "archivo_pedido.registrar.ok codigo=%s pedido_id=%s tipo=%s archivo_id=%s usuario=%s",
        codigo_operacion,
        pedido.id,
        tipo,
        archivo.id,
        operador.nombre if operador else data.usuario
    )

    return archivo_pedido_dict(
        archivo
    )


def guardar_upload_pedido(
    db: Session,
    codigo_operacion: str,
    tipo: str,
    archivo: UploadFile,
    usuario: str | None = None,
    notas: str | None = None,
    operador: Operador | None = None
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
    ruta_relativa = Path("pedidos") / codigo_operacion / nombre_seguro
    ruta_archivo = guardar_upload_persistente(
        archivo,
        ruta_relativa,
        content_type
    )

    data = ArchivoPedidoCreate(
        tipo=tipo,
        ruta_archivo=ruta_archivo,
        nombre_archivo=archivo.filename,
        mime_type=content_type,
        notas=notas,
        usuario=usuario
    )

    return registrar_archivo_pedido(
        db,
        codigo_operacion,
        data,
        operador=operador
    )
