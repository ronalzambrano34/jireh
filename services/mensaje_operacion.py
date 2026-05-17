from urllib.parse import quote

from sqlalchemy.orm import (
    Session
)

from models.metodo_pago import (
    MetodoPago
)

from models.pedido_transferencia import (
    PedidoTransferencia
)

from models.pedido_efectivo import (
    PedidoEfectivo
)

from models.pedido_saldo import (
    PedidoSaldo
)

from models.pedido_divisa import (
    PedidoDivisa
)

from services.template_service import (
    render_template
)


def generar_mensaje_operacion(
    db: Session,
    pedido
):

    metodo_pago = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.id
            ==
            pedido.tipo_pago_id
        )
        .first()
    )

    metodo_nombre = (
        metodo_pago.nombre
        if metodo_pago
        else ""
    )

    variables = {

        "monto_pago":
        pedido.monto_pago,

        "moneda_pago":
        pedido.moneda_pago,

        "tasa_final":
        pedido.tasa_final,

        "monto_resultado":
        pedido.monto_resultado,

        "metodo_pago":
        metodo_nombre
    }

    template_key = None

    # transferencia

    if pedido.servicio == "transferencia":

        detalle = (
            db.query(
                PedidoTransferencia
            )
            .filter(
                PedidoTransferencia.pedido_id
                ==
                pedido.id
            )
            .first()
        )

        variables.update({

            "numero_tarjeta":
            detalle.numero_tarjeta,

            "telefono":
            detalle.telefono_opcional
            or ""
        })

        template_key = (
            "template_transferencia"
        )

    # efectivo

    elif pedido.servicio == "efectivo":

        template_key = (
            "template_efectivo"
        )

    # saldo

    elif pedido.servicio == "saldo":

        detalle = (
            db.query(
                PedidoSaldo
            )
            .filter(
                PedidoSaldo.pedido_id
                ==
                pedido.id
            )
            .first()
        )

        variables.update({

            "numero_telefono":
            detalle.numero_telefono,

            "saldo_cup":
            detalle.saldo_cup
        })

        template_key = (
            "template_saldo"
        )

    # divisa

    elif pedido.servicio == "divisa":

        detalle = (
            db.query(
                PedidoDivisa
            )
            .filter(
                PedidoDivisa.pedido_id
                ==
                pedido.id
            )
            .first()
        )

        variables.update({

            "tipo_tarjeta":
            detalle.tipo_tarjeta,

            "numero_tarjeta":
            detalle.numero_tarjeta,

            "monto_divisa":
            detalle.monto_divisa
        })

        template_key = (
            "template_divisa"
        )

    mensaje = render_template(
        db=db,
        clave=template_key,
        variables=variables
    )

    whatsapp_url = (
        "https://wa.me/?text="
        + quote(mensaje)
    )

    return {

        "mensaje":
        mensaje,

        "whatsapp_url":
        whatsapp_url
    }