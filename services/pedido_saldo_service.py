from sqlalchemy.orm import Session

from models.operador import Operador
from models.paquete_saldo import PaqueteSaldo
from models.pedido import Pedido
from models.pedido_saldo import PedidoSaldo

from services.configuracion_service import (
    render_template
)
from services.generador_codigo import (
    generar_codigo_operacion
)
from services.monedas import normalizar_moneda


MENSAJE_SALDO_DEFAULT = """
*Saldo Móvil*

*Número:* {numero_telefono}

*Saldo:* {saldo_cup} CUP

*Pago:* {monto_pago} {moneda_pago}
"""


def buscar_paquete_saldo(
    db: Session,
    paquete_saldo_id: int | None,
    monto_pago: float | None,
    moneda_pago: str
):
    query = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.activo == True
        )
    )

    if paquete_saldo_id is not None:
        return (
            query
            .filter(
                PaqueteSaldo.id == paquete_saldo_id
            )
            .first()
        )

    if monto_pago is None:
        raise Exception(
            "Debe enviar paquete_saldo_id o monto_pago"
        )

    return (
        query
        .filter(
            PaqueteSaldo.moneda_pago == moneda_pago,
            PaqueteSaldo.monto_pago == monto_pago
        )
        .first()
    )


def crear_pedido_saldo(
    db: Session,
    data
):

    moneda_pago = normalizar_moneda(
        data.moneda_pago
    )

    paquete = buscar_paquete_saldo(
        db,
        data.paquete_saldo_id,
        data.monto_pago,
        moneda_pago
    )

    if not paquete:
        raise Exception(
            "No existe paquete de saldo activo "
            f"para {moneda_pago}"
        )

    monto_pago = float(
        paquete.monto_pago
    )

    saldo_cup = float(
        paquete.saldo_cup
    )

    tasa_usada = (
        saldo_cup / monto_pago
        if monto_pago
        else 0
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

    codigo = generar_codigo_operacion(
        operador.codigo_operador,
        "saldo"
    )

    pedido = Pedido(
        codigo_operacion=codigo,
        operador_id=operador.id,
        servicio="saldo",
        estado="pendiente",
        monto_pago=monto_pago,
        moneda_pago=moneda_pago,
        tipo_pago_id=data.tipo_pago_id,
        oferta_id=None,
        tasa_usada=tasa_usada,
        bonificacion=0,
        tasa_final=tasa_usada,
        monto_resultado=saldo_cup
    )

    db.add(
        pedido
    )

    db.commit()

    db.refresh(
        pedido
    )

    detalle = PedidoSaldo(
        pedido_id=pedido.id,
        numero_telefono=data.numero_telefono,
        saldo_cup=saldo_cup
    )

    db.add(
        detalle
    )

    db.commit()

    mensaje = render_template(
        db,
        "mensaje_saldo",
        MENSAJE_SALDO_DEFAULT,
        {
            "codigo": codigo,
            "numero_telefono": data.numero_telefono,
            "saldo_cup": saldo_cup,
            "monto_pago": monto_pago,
            "moneda_pago": moneda_pago,
            "tasa": tasa_usada,
            "paquete": paquete.nombre
        }
    )

    return {
        "codigo": codigo,
        "mensaje": mensaje
    }
