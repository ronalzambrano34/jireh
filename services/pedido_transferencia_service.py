from sqlalchemy.orm import Session

from models.operador import (
    Operador
)

from services.pedido_creator import (
    crear_pedido
)


def crear_pedido_transferencia(
    db: Session,
    data
):

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id
            ==
            data.operador_id
        )
        .first()
    )

    if not operador:
        raise Exception(
            "Operador no encontrado"
        )

    payload = {

        "cliente_id":
        1,

        "operador_id":
        operador.id,

        "operador_codigo":
        operador.codigo_operador,

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