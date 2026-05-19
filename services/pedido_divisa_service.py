from sqlalchemy.orm import Session

from services.monedas import normalizar_moneda
from services.pedido_creator import (
    crear_pedido
)


def crear_pedido_divisa(
    db: Session,
    data
):

    payload = {

        "cliente_id":
        getattr(
            data,
            "cliente_id",
            None
        ),

        "numero_telefono_cliente":
        getattr(
            data,
            "numero_telefono_cliente",
            None
        ),

        "operador_id":
        data.operador_id,

        "servicio":
        "divisa",

        "moneda_pago":
        normalizar_moneda(
            data.moneda_pago
        ),

        "monto_pago":
        data.monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "tipo_tarjeta":
        data.tipo_tarjeta,

        "numero_tarjeta":
        data.numero_tarjeta,

        "telefono_destinatario":
        getattr(
            data,
            "telefono_destinatario",
            None
        ),

        "monto_divisa":
        data.monto_divisa,

        "bonificacion_manual":
        0
    }

    return crear_pedido(
        db=db,
        data=payload
    )
