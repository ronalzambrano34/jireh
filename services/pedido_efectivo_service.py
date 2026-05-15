from sqlalchemy.orm import Session

from models.oferta import Oferta
from models.operador import Operador
from models.pedido import Pedido
from models.pedido_efectivo import (
    PedidoEfectivo
)
from models.punto_recogida import (
    PuntoRecogida
)

from services.generador_codigo import (
    generar_codigo_operacion
)
from services.configuracion_service import (
    render_template
)
from services.monedas import normalizar_moneda


MENSAJE_EFECTIVO_DEFAULT = """
*Recoger de parte del Jireh*

{monto_cup} CUP

{direccion}

Telf: {telefono_punto}

Escribir y coordinar recogida solo por WhatsApp.

Importante:
Nada de palabra REMESAS, no preguntar a los vecinos y cualquier duda llamar directamente.

*Pago:* {monto_pago} {moneda_pago}

*Oferta:* {tasa}
"""


def crear_pedido_efectivo(
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
            == "efectivo",
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
            "No existe oferta activa para efectivo "
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
            "Punto no encontrado"
        )

    monto_cup = (
        monto_pago
        *
        oferta.tasa
    )

    codigo = (
        generar_codigo_operacion(
            operador.codigo_operador,
            "efectivo"
        )
    )

    pedido = Pedido(

        codigo_operacion=codigo,

        operador_id=operador.id,

        servicio="efectivo",

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

    db.add(
        pedido
    )

    db.commit()

    db.refresh(
        pedido
    )

    detalle = (
        PedidoEfectivo(
            pedido_id=pedido.id,

            monto_cup=monto_cup,

            punto_recogida_id=
            punto.id
        )
    )

    db.add(
        detalle
    )

    db.commit()

    mensaje = render_template(
        db,
        "mensaje_efectivo",
        MENSAJE_EFECTIVO_DEFAULT,
        {
            "monto_cup": monto_cup,
            "direccion": punto.direccion,
            "telefono_punto": punto.telefono or "",
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
