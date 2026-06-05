from sqlalchemy.orm import Session

from Backend.models.oferta import Oferta
from Backend.models.paquete_saldo import (
    PaqueteSaldo
)


def buscar_oferta(
    db: Session,
    servicio: str,
    moneda_pago: str,
    monto_pago: float
):

    ofertas = (
        db.query(
            Oferta
        )
        .filter(
            Oferta.servicio
            ==
            servicio,

            Oferta.moneda_pago
            ==
            moneda_pago,

            Oferta.activa
            ==
            True
        )
        .order_by(
            Oferta.minimo_pago.desc()
        )
        .all()
    )

    for oferta in ofertas:

        minimo = (
            oferta.minimo_pago
            or 0
        )

        if monto_pago >= minimo:

            return oferta

    raise Exception(
        "No existe oferta activa"
    )


def calcular_transferencia_efectivo(
    db: Session,
    servicio: str,
    moneda_pago: str,
    monto_pago: float,
    bonificacion_manual: float = 0
):

    oferta = buscar_oferta(
        db=db,
        servicio=servicio,
        moneda_pago=moneda_pago,
        monto_pago=monto_pago
    )

    tasa = float(
        oferta.tasa
    )

    bonificacion = (
        float(
            getattr(
                oferta,
                "bonificacion",
                0
            ) or 0
        )
        +
        float(
            bonificacion_manual
            or 0
        )
    )

    tasa_final = (
        tasa
        + bonificacion
    )

    monto_resultado = round(
        monto_pago
        * tasa_final
    )

    ganancia = round(
        monto_pago
        *
        float(
            getattr(
                oferta,
                "ganancia",
                0
            ) or 0
        ),
        2
    )

    return {

        "oferta_id":
        oferta.id,

        "tasa":
        tasa,

        "bonificacion":
        bonificacion,

        "tasa_final":
        tasa_final,

        "monto_resultado":
        monto_resultado,

        "ganancia":
        ganancia
    }


def calcular_saldo(
    db: Session,
    moneda_pago: str,
    monto_pago: float
):

    paquete = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.moneda_pago
            ==
            moneda_pago,

            PaqueteSaldo.monto_pago
            ==
            monto_pago,

            PaqueteSaldo.activo
            ==
            True
        )
        .first()
    )

    if not paquete:

        raise Exception(
            "Paquete saldo no encontrado"
        )

    return {

        "paquete_id":
        paquete.id,

        "tasa":
        float(
            paquete.monto_pago
        ),

        "bonificacion":
        0,

        "tasa_final":
        float(
            paquete.monto_pago
        ),

        "saldo_cup":
        paquete.saldo_cup,

        "monto_resultado":
        paquete.saldo_cup,

        "ganancia":
        float(
            getattr(
                paquete,
                "ganancia",
                0
            ) or 0
        )
    }


def calcular_operacion(
    db: Session,
    servicio: str,
    moneda_pago: str,
    monto_pago: float,
    bonificacion_manual: float = 0
):

    servicio = (
        servicio
        .strip()
        .lower()
    )

    if servicio in [
        "transferencia",
        "efectivo"
    ]:

        return calcular_transferencia_efectivo(
            db=db,
            servicio=servicio,
            moneda_pago=moneda_pago,
            monto_pago=monto_pago,
            bonificacion_manual=
            bonificacion_manual
        )

    if servicio == "saldo":

        return calcular_saldo(
            db=db,
            moneda_pago=moneda_pago,
            monto_pago=monto_pago
        )

    raise Exception(
        "Servicio no soportado"
    )
