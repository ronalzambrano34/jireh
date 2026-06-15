import base64
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import UploadFile
import requests

from Backend.config import IS_VERCEL
from Backend.config import SUPABASE_SERVICE_ROLE_KEY
from Backend.config import SUPABASE_STORAGE_BUCKET
from Backend.config import SUPABASE_URL
from Backend.config import UPLOAD_ALLOWED_MIME_TYPES
from Backend.config import UPLOAD_MAX_BYTES
from Backend.config import STORAGE_DIR
from Backend.config import USE_SUPABASE_STORAGE
from sqlalchemy.orm import Session

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.pedido import Pedido
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_otros import PedidoOtros
from Backend.models.operador import Operador

from Backend.schemas.archivo_pedido import (
    ArchivoPedidoCreate,
    TIPOS_ARCHIVO_PEDIDO
)
from Backend.services.pedido_service import validar_bloqueo_pedido


_supabase_bucket_ready = False


def _leer_upload(archivo: UploadFile):
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


def _asegurar_bucket_supabase():
    global _supabase_bucket_ready
    if _supabase_bucket_ready:
        return

    bucket = quote(
        SUPABASE_STORAGE_BUCKET,
        safe=""
    )
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    consulta = requests.get(
        f"{SUPABASE_URL}/storage/v1/bucket/{bucket}",
        headers=headers,
        timeout=15,
    )
    if consulta.status_code == 200:
        _supabase_bucket_ready = True
        return
    if consulta.status_code not in {400, 404}:
        raise Exception(
            "No se pudo consultar el almacenamiento de comprobantes"
        )

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
    if response.status_code not in {200, 201}:
        raise Exception(
            "No se pudo preparar el almacenamiento de comprobantes"
        )

    _supabase_bucket_ready = True


def _guardar_upload_supabase(
    ruta_relativa: Path,
    content_type: str,
    contenido: bytes
):
    _asegurar_bucket_supabase()
    ruta = quote(
        ruta_relativa.as_posix(),
        safe="/"
    )
    bucket = quote(
        SUPABASE_STORAGE_BUCKET,
        safe=""
    )
    response = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{bucket}/{ruta}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "false",
        },
        data=contenido,
        timeout=30,
    )
    if response.status_code not in {200, 201}:
        raise Exception(
            "No se pudo guardar el comprobante"
        )

    return (
        f"{SUPABASE_URL}/storage/v1/object/public/"
        f"{bucket}/{ruta}"
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

    if tipo == "documento_identidad":
        detalle_efectivo = (
            db.query(PedidoEfectivo)
            .filter(PedidoEfectivo.pedido_id == pedido.id)
            .first()
        )
        if detalle_efectivo:
            detalle_efectivo.documento_identidad_url = ruta_archivo
            db.commit()

        detalle_otros = (
            db.query(PedidoOtros)
            .filter(PedidoOtros.pedido_id == pedido.id)
            .first()
        )
        if detalle_otros:
            detalle_otros.documento_identidad_url = ruta_archivo
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
    contenido = _leer_upload(archivo)

    if USE_SUPABASE_STORAGE:
        ruta_archivo = _guardar_upload_supabase(
            ruta_relativa,
            content_type,
            contenido
        )
    elif IS_VERCEL:
        ruta_archivo = (
            f"data:{content_type};base64,"
            + base64.b64encode(contenido).decode("ascii")
        )
    else:
        carpeta = STORAGE_DIR / "pedidos" / codigo_operacion
        carpeta.mkdir(
            parents=True,
            exist_ok=True
        )
        destino = STORAGE_DIR / ruta_relativa
        try:
            destino.write_bytes(contenido)
        except Exception:
            if destino.exists():
                destino.unlink()
            raise
        ruta_archivo = (
            "/"
            + str(Path("storage") / ruta_relativa).replace("\\", "/")
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
