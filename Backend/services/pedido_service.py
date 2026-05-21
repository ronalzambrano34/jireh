from sqlalchemy.orm import Session

from datetime import datetime
from datetime import timedelta

from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_saldo import PedidoSaldo
from Backend.models.pedido_transferencia import PedidoTransferencia
from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.operador import Operador

from Backend.models.pedido_historial import (PedidoHistorial)
from Backend.services.pedido_estado import (PedidoEstado)

ESTADOS_ALIASES = {
    "pendiente": PedidoEstado.PENDIENTE_PAGO,
    "pendiente_pago": PedidoEstado.PENDIENTE_PAGO,
    "en_proceso": PedidoEstado.EN_OPERACION,
    "realizado": PedidoEstado.COMPLETADO,
    "finalizado": PedidoEstado.COMPLETADO,
    "error_operacion": PedidoEstado.ERROR,
}

ESTADOS_PERMITIDOS = (
    set(
        PedidoEstado.TODOS
    )
    | set(
        ESTADOS_ALIASES
    )
)

LOCK_MINUTES = 15


def _utcnow():
    return datetime.utcnow()


def _lock_activo(
    pedido: Pedido,
    now: datetime | None = None
):
    if not pedido.operador_asignado_id or not pedido.lock_expires_at:
        return False

    return pedido.lock_expires_at > (now or _utcnow())


def _operador_puede_tomar_bloqueo(
    operador: Operador | None
):
    if not operador:
        return False

    return (
        operador.rol in ("admin", "supervisor")
        or "empresa:control_total" in operador.permisos
    )


def _operador_asignado_nombre(
    db: Session,
    operador_id: int | None
):
    if not operador_id:
        return None

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id == operador_id
        )
        .first()
    )

    return operador.nombre if operador else None


def _lock_dict(
    db: Session,
    pedido: Pedido
):
    lock_activo = _lock_activo(
        pedido
    )
    return {
        "operador_asignado_id": pedido.operador_asignado_id,
        "operador_asignado_nombre": _operador_asignado_nombre(
            db,
            pedido.operador_asignado_id
        ),
        "asignado_en": pedido.asignado_en,
        "lock_expires_at": pedido.lock_expires_at,
        "lock_activo": lock_activo,
    }


def validar_bloqueo_pedido(
    db: Session,
    pedido: Pedido,
    operador: Operador | None
):
    if not _lock_activo(
        pedido
    ):
        return

    if operador and pedido.operador_asignado_id == operador.id:
        return

    if _operador_puede_tomar_bloqueo(
        operador
    ):
        return

    nombre = _operador_asignado_nombre(
        db,
        pedido.operador_asignado_id
    ) or "otro operador"
    raise Exception(
        f"Esta operacion esta siendo trabajada por {nombre}."
    )


def _asignar_bloqueo(
    pedido: Pedido,
    operador: Operador
):
    now = _utcnow()
    if pedido.operador_asignado_id != operador.id:
        pedido.operador_asignado_id = operador.id
        pedido.asignado_en = now

    pedido.lock_expires_at = now + timedelta(
        minutes=LOCK_MINUTES
    )


def pedido_base_dict(
    pedido: Pedido
):
    return {
        "id": pedido.id,
        "codigo_operacion": pedido.codigo_operacion,
        "servicio": pedido.servicio,
        "estado": pedido.estado,
        "monto_pago": pedido.monto_pago,
        "moneda_pago": pedido.moneda_pago,
        "tasa_usada": pedido.tasa_usada,
        "bonificacion": pedido.bonificacion,
        "tasa_final": pedido.tasa_final,
        "monto_resultado": pedido.monto_resultado,
        "ganancia": pedido.ganancia,
        "comprobante_pago": pedido.comprobante_pago,
        "observaciones": pedido.observaciones,
        "cliente_id": pedido.cliente_id,
        "operador_id": pedido.operador_id,
        "tipo_pago_id": pedido.tipo_pago_id,
        "oferta_id": pedido.oferta_id,
        "created_at": pedido.created_at,
        "updated_at": pedido.updated_at,
    }


def detalle_transferencia(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoTransferencia
        )
        .filter(
            PedidoTransferencia.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "numero_tarjeta": detalle.numero_tarjeta,
        "telefono_destinatario": detalle.telefono_destinatario,
        "monto_cup": detalle.monto_cup,
    }


def detalle_efectivo(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoEfectivo
        )
        .filter(
            PedidoEfectivo.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "monto_cup": detalle.monto_cup,
        "telefono_destinatario": detalle.telefono_destinatario,
        "punto_recogida_id": detalle.punto_recogida_id,
        "documento_identidad_url": detalle.documento_identidad_url,
    }


def detalle_saldo(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoSaldo
        )
        .filter(
            PedidoSaldo.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "telefono_destinatario": detalle.telefono_destinatario,
        "saldo_cup": detalle.saldo_cup,
    }


def detalle_divisa(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoDivisa
        )
        .filter(
            PedidoDivisa.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "tipo_tarjeta": detalle.tipo_tarjeta,
        "numero_tarjeta": detalle.numero_tarjeta,
        "telefono_destinatario": detalle.telefono_destinatario,
        "monto_divisa": detalle.monto_divisa,
    }


def listar_archivos_dict(
    db: Session,
    pedido_id: int
):
    archivos = (
        db.query(
            ArchivoPedido
        )
        .filter(
            ArchivoPedido.pedido_id == pedido_id
        )
        .order_by(
            ArchivoPedido.created_at.desc(),
            ArchivoPedido.id.desc()
        )
        .all()
    )

    return [
        {
            "id": archivo.id,
            "tipo": archivo.tipo,
            "ruta_archivo": archivo.ruta_archivo,
            "nombre_archivo": archivo.nombre_archivo,
            "mime_type": archivo.mime_type,
            "notas": archivo.notas,
            "usuario": archivo.usuario,
            "created_at": archivo.created_at,
        }
        for archivo in archivos
    ]


def obtener_detalle(
    db: Session,
    pedido: Pedido
):
    detalles = {
        "transferencia": detalle_transferencia,
        "efectivo": detalle_efectivo,
        "saldo": detalle_saldo,
        "divisa": detalle_divisa,
    }

    resolver = detalles.get(
        pedido.servicio
    )

    if not resolver:
        return None

    return resolver(
        db,
        pedido.id
    )


def pedido_dict(
    db: Session,
    pedido: Pedido,
    incluir_detalle: bool = False
):
    data = pedido_base_dict(
        pedido
    )

    if incluir_detalle:
        data["detalle"] = obtener_detalle(
            db,
            pedido
        )
        data["archivos"] = listar_archivos_dict(
            db,
            pedido.id
        )

    data.update(
        _lock_dict(
            db,
            pedido
        )
    )

    return data


def listar_pedidos(
    db: Session,
    estado: str | None = None,
    servicio: str | None = None,
    limit: int = 50,
    offset: int = 0
):
    query = db.query(
        Pedido
    )

    if estado:
        estado_normalizado = (
            estado
            .strip()
            .lower()
        )
        estado_normalizado = ESTADOS_ALIASES.get(
            estado_normalizado,
            estado_normalizado
        )

        query = query.filter(
            Pedido.estado == estado_normalizado
        )

    if servicio:
        query = query.filter(
            Pedido.servicio == servicio.strip().lower()
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

    pedidos = (
        query
        .order_by(
            Pedido.created_at.desc(),
            Pedido.id.desc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )

    return [
        pedido_dict(
            db,
            pedido,
            incluir_detalle=True
        )
        for pedido in pedidos
    ]


def obtener_pedido_por_codigo(
    db: Session,
    codigo_operacion: str
):
    pedido = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.codigo_operacion == codigo_operacion
        )
        .first()
    )

    if not pedido:
        raise Exception(
            "Pedido no encontrado"
        )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def _obtener_modelo_pedido_por_codigo(
    db: Session,
    codigo_operacion: str
):
    pedido = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.codigo_operacion == codigo_operacion
        )
        .first()
    )

    if not pedido:
        raise Exception(
            "Pedido no encontrado"
        )

    return pedido


def tomar_operacion_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion
    )

    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )
    _asignar_bloqueo(
        pedido,
        operador
    )

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def renovar_bloqueo_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion
    )

    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )
    _asignar_bloqueo(
        pedido,
        operador
    )

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def liberar_bloqueo_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion
    )

    if (
        pedido.operador_asignado_id
        and pedido.operador_asignado_id != operador.id
        and not _operador_puede_tomar_bloqueo(
            operador
        )
    ):
        validar_bloqueo_pedido(
            db,
            pedido,
            operador
        )

    pedido.operador_asignado_id = None
    pedido.asignado_en = None
    pedido.lock_expires_at = None

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def actualizar_estado_pedido(
    db: Session,
    codigo_operacion: str,
    estado: str,
    comprobante_pago: str | None = None,
    observaciones: str | None = None,
    usuario: str | None = None,
    comentario: str | None = None,
    operador: Operador | None = None
):

    estado_normalizado = (
        estado
        .strip()
        .lower()
    )

    if (
        estado_normalizado
        not in
        ESTADOS_PERMITIDOS
    ):
        raise Exception(
            "Estado no permitido. Use: "
            + ", ".join(
                sorted(
                    ESTADOS_PERMITIDOS
                )
            )
        )

    estado_normalizado = (
        ESTADOS_ALIASES.get(
            estado_normalizado,
            estado_normalizado
        )
    )

    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion
    )

    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )

    if operador:
        _asignar_bloqueo(
            pedido,
            operador
        )

    estado_anterior = (
        pedido.estado
    )

    pedido.estado = (
        estado_normalizado
    )

    # comprobante opcional

    if (
        comprobante_pago
        is not None
    ):
        pedido.comprobante_pago = (
            comprobante_pago
        )

    if (
        observaciones
        is not None
    ):
        pedido.observaciones = (
            observaciones
        )

    # timestamps automáticos

    if (
        estado_normalizado
        ==
        PedidoEstado.PAGO_CONFIRMADO
    ):
        pedido.fecha_pago_confirmado = (
            datetime.utcnow()
        )

    elif (
        estado_normalizado
        ==
        PedidoEstado.EN_OPERACION
    ):
        pedido.fecha_en_operacion = (
            datetime.utcnow()
        )

    elif (
        estado_normalizado
        ==
        PedidoEstado.COMPLETADO
    ):
        pedido.fecha_completado = (
            datetime.utcnow()
        )

    # historial

    historial = (
        PedidoHistorial(
            pedido_id=
            pedido.id,

            estado_anterior=
            estado_anterior,

            estado_nuevo=
            estado_normalizado,

            usuario=
            usuario,

            comentario=
            comentario
        )
    )

    db.add(
        historial
    )

    db.commit()

    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )
