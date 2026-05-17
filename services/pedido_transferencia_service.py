from sqlalchemy.orm import Session

from services.pedido_creator import (
    crear_pedido
)


def crear_pedido_transferencia(
    db: Session,
    data
):

    payload = {

        "cliente_id":
        getattr(
            data,
            "cliente_id",
            None
        ) or 1,

        "operador_id":
        data.operador_id,

        "servicio":
        "transferencia",

        "moneda_pago":
        data.moneda_pago,

        "monto_pago":
        data.monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "numero_tarjeta":
        data.numero_tarjeta,

        "telefono_opcional":
        getattr(
            data,
            "telefono",
            None
        ),

        "bonificacion_manual":
        getattr(
            data,
            "bonificacion_manual",
            0
        )
    }

    return crear_pedido(
        db=db,
        data=payload
    )