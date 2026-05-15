from sqlalchemy.orm import Session

from models.operador import Operador
from models.pedido import Pedido
from models.pedido_divisa import PedidoDivisa

from services.configuracion_service import (
    render_template
)
from services.generador_codigo import (
    generar_codigo_operacion
)
from services.monedas import normalizar_moneda


MENSAJE_DIVISA_DEFAULT = """
*Divisa*

*Tipo de tarjeta:* {tipo_tarjeta}

*Número de tarjeta:* {numero_tarjeta}

*Monto divisa:* {monto_divisa}

*Pago:* {monto_pago} {moneda_pago}

*Tasa efectiva:* {tasa}
"""


def crear_pedido_divisa(
    db: Session,
    data
):

    moneda_pago = normalizar_moneda(
        data.moneda_pago
    )

    monto_pago = data.monto_pago

    if monto_pago <= 0:
        raise Exception(
            "El monto_pago debe ser mayor que cero"
        )

    if data.monto_divisa <= 0:
        raise Exception(
            "El monto_divisa debe ser mayor que cero"
        )

    operador = (
        db.query(
            Operador
        )
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

    tasa_usada = data.monto_divisa / monto_pago

    codigo = generar_codigo_operacion(
        operador.codigo_operador,
        "divisa"
    )

    pedido = Pedido(
        codigo_operacion=codigo,
        operador_id=operador.id,
        servicio="divisa",
        estado="pendiente",
        monto_pago=monto_pago,
        moneda_pago=moneda_pago,
        tipo_pago_id=data.tipo_pago_id,
        oferta_id=None,
        tasa_usada=tasa_usada,
        bonificacion=0,
        tasa_final=tasa_usada,
        monto_resultado=data.monto_divisa
    )

    db.add(
        pedido
    )

    db.commit()

    db.refresh(
        pedido
    )

    detalle = PedidoDivisa(
        pedido_id=pedido.id,
        tipo_tarjeta=data.tipo_tarjeta,
        numero_tarjeta=data.numero_tarjeta,
        monto_divisa=data.monto_divisa
    )

    db.add(
        detalle
    )

    db.commit()

    mensaje = render_template(
        db,
        "mensaje_divisa",
        MENSAJE_DIVISA_DEFAULT,
        {
            "codigo": codigo,
            "tipo_tarjeta": data.tipo_tarjeta,
            "numero_tarjeta": data.numero_tarjeta,
            "monto_divisa": data.monto_divisa,
            "monto_pago": monto_pago,
            "moneda_pago": moneda_pago,
            "tasa": tasa_usada
        }
    )

    return {
        "codigo": codigo,
        "mensaje": mensaje
    }
