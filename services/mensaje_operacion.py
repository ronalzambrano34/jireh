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

from models.cliente import (
    Cliente
)

from services.template_service import (
    render_template,
    render_text_template
)


DEFAULT_TEMPLATES = {
    "template_transferencia": (
        "*Transferencia*\n"
        "*Tarjeta:* {{numero_tarjeta}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Monto CUP:* {{monto_resultado}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Metodo de pago:* {{metodo_pago}}"
    ),
    "template_efectivo": (
        "*Efectivo*\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Monto CUP:* {{monto_resultado}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Metodo de pago:* {{metodo_pago}}"
    ),
    "template_saldo": (
        "*Saldo Movil*\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Saldo:* {{saldo_cup}} CUP\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}"
    ),
    "template_divisa": (
        "*Divisa*\n"
        "*Tipo de tarjeta:* {{tipo_tarjeta}}\n"
        "*Numero de tarjeta:* {{numero_tarjeta}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Monto divisa:* {{monto_divisa}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Tasa efectiva:* {{tasa_final}}"
    )
}


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

    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.id
            ==
            pedido.cliente_id
        )
        .first()
    )

    cliente_nombre = (
        cliente.nombre
        if cliente
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
        metodo_nombre,

        "codigo_operacion":
        pedido.codigo_operacion,

        "cliente_nombre":
        cliente_nombre
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

            "telefono_destinatario":
            (
                detalle.telefono_destinatario
                if detalle
                else ""
            )
            or ""
        })

        template_key = (
            "template_transferencia"
        )

    # efectivo

    elif pedido.servicio == "efectivo":

        detalle = (
            db.query(
                PedidoEfectivo
            )
            .filter(
                PedidoEfectivo.pedido_id
                ==
                pedido.id
            )
            .first()
        )

        variables.update({

            "telefono_destinatario":
            (
                detalle.telefono_destinatario
                if detalle
                else ""
            )
            or ""
        })

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

            "telefono_destinatario":
            detalle.telefono_destinatario,

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

            "telefono_destinatario":
            (
                detalle.telefono_destinatario
                if detalle
                else ""
            )
            or "",

            "monto_divisa":
            detalle.monto_divisa
        })

        template_key = (
            "template_divisa"
        )

    try:
        mensaje = render_template(
            db=db,
            clave=template_key,
            variables=variables
        )
    except Exception:
        mensaje = render_text_template(
            DEFAULT_TEMPLATES[template_key],
            variables
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