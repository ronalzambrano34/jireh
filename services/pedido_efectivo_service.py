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


def crear_pedido_efectivo(
    db: Session,
    data
):

    oferta = (
        db.query(Oferta)
        .filter(
            Oferta.servicio
            == "efectivo",
            Oferta.activa == True,
            Oferta.minimo_brl
            <= data.pix
        )
        .order_by(
            Oferta.minimo_brl.desc()
        )
        .first()
    )

    if not oferta:

        raise Exception(
            "No existe oferta activa"
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
        data.pix
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

        monto_brl=data.pix,

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

    mensaje = f"""
*Recoger de parte del Jireh*

{monto_cup} CUP

{punto.direccion}

Telf: {punto.telefono}

Escribir y coordinar recogida solo por WhatsApp.

Importante:
Nada de palabra REMESAS, no preguntar a los vecinos y cualquier duda llamar directamente.

*Pix:* {data.pix}

*Oferta:* {oferta.tasa}
"""

    return {

        "codigo":
        codigo,

        "mensaje":
        mensaje
    }