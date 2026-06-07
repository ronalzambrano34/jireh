from sqlalchemy.orm import Session

from Backend.services.monedas import normalizar_moneda
from Backend.services.pedido_creator import (
    crear_pedido
)


def crear_pedido_divisa(
    db: Session,
    data
):

    payload = {

        "cliente_id":
        (
            getattr(
                data,
                "cliente_id",
                None
            )
            or None
        ),

        "nombre_cliente":
        getattr(
            data,
            "nombre_cliente",
            None
        ),

        "numero_telefono_cliente":
        getattr(
            data,
            "numero_telefono_cliente",
            None
        ),

        "contacto_id":
        getattr(
            data,
            "contacto_id",
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

        "cuenta_pago_id":
        getattr(data, "cuenta_pago_id", None),

        "tipo_tarjeta":
        getattr(
            data,
            "tipo_tarjeta",
            None
        ),

        "numero_tarjeta":
        getattr(
            data,
            "numero_tarjeta",
            None
        ),

        "telefono_destinatario":
        getattr(
            data,
            "telefono_destinatario",
            None
        ),

        "bonificacion_manual":
        0,

        "observaciones":
        getattr(
            data,
            "observaciones",
            None
        )
    }

    return crear_pedido(
        db=db,
        data=payload
    )
