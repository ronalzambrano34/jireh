from urllib.parse import quote

from sqlalchemy.orm import (
    Session
)

from Backend.models.metodo_pago import (
    MetodoPago
)

from Backend.models.pedido_transferencia import (
    PedidoTransferencia
)

from Backend.models.pedido_efectivo import (
    PedidoEfectivo
)

from Backend.models.pedido_saldo import (
    PedidoSaldo
)

from Backend.models.pedido_divisa import (
    PedidoDivisa
)
from Backend.models.pedido_otros import PedidoOtros

from Backend.models.cliente import (
    Cliente
)
from Backend.models.operador import Operador

from Backend.services.template_service import (
    render_template,
    render_text_template
)


DEFAULT_TEMPLATES = {
    "template_transferencia": (
        "*Transferencia*\n"
        "*Operador:* {{operador}}\n"
        "*Tarjeta:* {{numero_tarjeta}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Monto CUP:* {{monto_resultado}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Metodo de pago:* {{metodo_pago}}"
    ),
    "template_efectivo": (
        "*Efectivo*\n"
        "*Operador:* {{operador}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Foto documento:* {{documento_identidad_url}}\n"
        "*Monto CUP:* {{monto_resultado}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Metodo de pago:* {{metodo_pago}}"
    ),
    "template_saldo": (
        "*Saldo Movil*\n"
        "*Operador:* {{operador}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Saldo:* {{saldo_cup}} CUP\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}"
    ),
    "template_divisa": (
        "*Divisa*\n"
        "*Operador:* {{operador}}\n"
        "*Tipo de tarjeta:* {{tipo_tarjeta}}\n"
        "*Numero de tarjeta:* {{numero_tarjeta}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Monto divisa:* {{monto_divisa}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Tasa efectiva:* {{tasa_final}}"
    ),
    "template_otros": (
        "*Otros*\n"
        "*Operador:* {{operador}}\n"
        "*Cliente:* {{cliente_nombre}}\n"
        "*Tarjeta:* {{numero_tarjeta}}\n"
        "*Telefono destinatario:* {{telefono_destinatario}}\n"
        "*Foto documento:* {{documento_identidad_url}}\n"
        "*Punto de recogida:* {{punto_recogida_id}}\n"
        "*Pago:* {{monto_pago}} {{moneda_pago}}\n"
        "*Metodo de pago:* {{metodo_pago}}\n"
        "*Info:* {{observaciones}}"
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

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id
            ==
            pedido.operador_id
        )
        .first()
    )

    variables = {

        "monto_pago":
        pedido.monto_pago,

        "moneda_pago":
        pedido.moneda_pago,

        "tasa_final":
        (
            pedido.monto_pago
            if pedido.servicio == "saldo"
            else pedido.tasa_final
        ),

        "monto_resultado":
        pedido.monto_resultado,

        "metodo_pago":
        metodo_nombre,

        "codigo_operacion":
        pedido.codigo_operacion,

        "cliente_nombre":
        cliente_nombre,

        "operador":
        (
            operador.nombre
            if operador
            else ""
        ),

        "operador_codigo":
        (
            operador.codigo_operador
            if operador
            else ""
        ),

        "operador_telefono":
        (
            operador.telefono
            if operador
            else ""
        )
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
            or "",

            "telefono":
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
            or "",

            "telefono":
            (
                detalle.telefono_destinatario
                if detalle
                else ""
            )
            or "",

            "documento_identidad_url":
            (
                detalle.documento_identidad_url
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

            "telefono":
            detalle.telefono_destinatario,

            "numero_telefono":
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

            "telefono":
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

    elif pedido.servicio == "otros":

        detalle = (
            db.query(PedidoOtros)
            .filter(PedidoOtros.pedido_id == pedido.id)
            .first()
        )

        variables.update({

            "observaciones":
            pedido.observaciones
            or "",

            "numero_tarjeta":
            (detalle.numero_tarjeta if detalle else "") or "",

            "telefono_destinatario":
            (detalle.telefono_destinatario if detalle else "") or "",

            "telefono":
            (detalle.telefono_destinatario if detalle else "") or "",

            "documento_identidad_url":
            (detalle.documento_identidad_url if detalle else "") or "",

            "punto_recogida_id":
            (detalle.punto_recogida_id if detalle else "") or ""
        })

        template_key = (
            "template_otros"
        )

    else:

        variables.update({

            "observaciones":
            pedido.observaciones
            or ""
        })

        template_key = (
            "template_otros"
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
