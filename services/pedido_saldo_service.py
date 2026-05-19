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


def _obtener_datos_saldo(
    db: Session,
    data
):

    if data.paquete_saldo_id is not None:
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

        return (
            float(
                paquete.monto_pago
            ),
            float(
                paquete.saldo_cup
            )
        )

    if data.monto_pago is None or data.saldo_cup is None:
        raise Exception(
            "Debe enviar paquete_saldo_id o monto_pago y saldo_cup"
        )

    monto_pago = float(
        data.monto_pago
    )

    saldo_cup = float(
        data.saldo_cup
    )

    if monto_pago <= 0:
        raise Exception(
            "El monto_pago debe ser mayor que cero"
        )

    if saldo_cup <= 0:
        raise Exception(
            "El saldo_cup debe ser mayor que cero"
        )

    return (
        monto_pago,
        saldo_cup
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

    monto_pago, saldo_cup = _obtener_datos_saldo(
        db,
        data
    )

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
        "saldo",

        "moneda_pago":
        moneda_pago,

        "monto_pago":
        monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "telefono_destinatario":
        data.telefono_destinatario,

        "saldo_cup":
        saldo_cup,

        "bonificacion_manual":
        0
    }

    return crear_pedido(
        db=db,
        data=payload
    )
