from sqlalchemy.orm import Session

from models.oferta import Oferta
from models.operador import Operador
from models.pedido import Pedido
from models.pedido_transferencia import (
    PedidoTransferencia
)

from services.generador_codigo import (
    generar_codigo_operacion
)
from services.configuracion_service import (
    render_template
)
from services.monedas import normalizar_moneda


MENSAJE_TRANSFERENCIA_DEFAULT = """
*Transferencia.*

{numero_tarjeta}

*Móvil:* {telefono}

*Monto CUP:* {monto_cup}

*Pago:* {monto_pago} {moneda_pago}

*Oferta:* {tasa}
"""


def crear_pedido_transferencia(
    db: Session,
    data
):

    moneda_pago = normalizar_moneda(
        data.moneda_pago
    )

    monto_pago = data.monto_pago

    oferta = (
        db.query(Oferta)
        .filter(
            Oferta.servicio
            == "transferencia",
            Oferta.activa == True,
            Oferta.moneda_pago
            == moneda_pago,
            Oferta.minimo_pago
            <= monto_pago
        )
        .order_by(
            Oferta.minimo_pago.desc()
        )
        .first()
    )

    if not oferta:

        raise Exception(
            "No existe oferta activa para transferencia "
            f"en {moneda_pago} con monto minimo <= {monto_pago}"
        )

    operador = (
        db.query(Operador)
        .filter(
            Operador.codigo_operador
            == data.operador_codigo
        )
        .first()
    )

    if not operador:

        raise Exception(
            "Operador no encontrado"
        )

    monto_cup = (
        monto_pago
        *
        oferta.tasa
    )

    codigo = (
        generar_codigo_operacion(
            operador.codigo_operador,
            "transferencia"
        )
    )

    pedido = Pedido(

        codigo_operacion=codigo,

        operador_id=operador.id,

        servicio="transferencia",

        estado="pendiente",

        monto_pago=monto_pago,

        moneda_pago=moneda_pago,

        tipo_pago_id=data.tipo_pago_id,

        oferta_id=oferta.id,

        tasa_usada=oferta.tasa,

        bonificacion=0,

        tasa_final=oferta.tasa,

        monto_resultado=monto_cup
    )

    db.add(pedido)

    db.commit()

    db.refresh(pedido)

    detalle = (
        PedidoTransferencia(
            pedido_id=pedido.id,

            numero_tarjeta=data.numero_tarjeta,

            telefono_opcional=data.telefono,

            monto_cup=monto_cup
        )
    )

    db.add(detalle)

    db.commit()

    mensaje = render_template(
        db,
        "mensaje_transferencia",
        MENSAJE_TRANSFERENCIA_DEFAULT,
        {
            "numero_tarjeta": data.numero_tarjeta,
            "telefono": data.telefono or "",
            "monto_cup": monto_cup,
            "monto_pago": monto_pago,
            "moneda_pago": moneda_pago,
            "tasa": oferta.tasa,
            "codigo": codigo
        }
    )

    return {

        "codigo":
        codigo,

        "mensaje":
        mensaje
    }
