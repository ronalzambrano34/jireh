from sqlalchemy.orm import Session

from datetime import datetime

from models.pedido import Pedido
from models.pedido_divisa import PedidoDivisa
from models.pedido_efectivo import PedidoEfectivo
from models.pedido_saldo import PedidoSaldo
from models.pedido_transferencia import PedidoTransferencia

from models.pedido_historial import (PedidoHistorial)
from services.pedido_estado import (PedidoEstado)

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
            pedido
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


def actualizar_estado_pedido(
    db: Session,
    codigo_operacion: str,
    estado: str,
    comprobante_pago: str | None = None,
    usuario: str | None = None,
    comentario: str | None = None
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
