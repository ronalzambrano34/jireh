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


def crear_pedido_transferencia(
    db: Session,
    data
):

    oferta = (
        db.query(Oferta)
        .filter(
            Oferta.servicio
            == "transferencia",
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

    monto_cup = (
        data.pix
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

        monto_brl=data.pix,

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

    return {

        "codigo":
        codigo,

        "mensaje":
        f"""
*Transferencia.*

{data.numero_tarjeta}

*Móvil:* {data.telefono}

*Monto CUP:* {monto_cup}

*Pix:* {data.pix}

*Oferta:* {oferta.tasa}
"""
    }