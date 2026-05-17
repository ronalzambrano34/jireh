from sqlalchemy.orm import Session

from models.punto_recogida import (
    PuntoRecogida
)

from services.pedido_creator import (
    crear_pedido
)

from services.monedas import (
    normalizar_moneda
)


def crear_pedido_efectivo(
    db: Session,
    data
):

    moneda_pago = (
        normalizar_moneda(
            data.moneda_pago
        )
    )

    punto = (
        db.query(
            PuntoRecogida
        )
        .filter(
            PuntoRecogida.id
            == data.punto_recogida_id
        )
        .first()
    )

    if not punto:

        raise Exception(
            "Punto de recogida no encontrado"
        )

    payload = {

        "cliente_id":
        1,

        "operador_id":
        data.operador_id,

        "servicio":
        "efectivo",

        "moneda_pago":
        moneda_pago,

        "monto_pago":
        data.monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "punto_recogida_id":
        data.punto_recogida_id,

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