from sqlalchemy.orm import Session

from models.paquete_saldo import (
    PaqueteSaldo
)

from services.pedido_creator import (
    crear_pedido
)

from services.monedas import (
    normalizar_moneda
)


def crear_pedido_saldo(
    db: Session,
    data
):

    moneda_pago = (
        normalizar_moneda(
            data.moneda_pago
        )
    )

    paquete = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.id
            == data.paquete_saldo_id,
            PaqueteSaldo.activo
            == True
        )
        .first()
    )

    if not paquete:

        raise Exception(
            "Paquete saldo no encontrado"
        )

    payload = {

        "cliente_id":
        1,

        "operador_id":
        data.operador_id,

        "servicio":
        "saldo",

        "moneda_pago":
        moneda_pago,

        "monto_pago":
        paquete.monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "numero_telefono":
        data.numero_telefono,

        "saldo_cup":
        paquete.saldo_cup,

        "bonificacion_manual":
        0
    }

    return crear_pedido(
        db=db,
        data=payload
    )