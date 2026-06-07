from sqlalchemy import func
from sqlalchemy.orm import Session

from Backend.models.extraccion_cuenta import ExtraccionCuenta
from Backend.models.metodo_pago import MetodoPago
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.pedido import Pedido


ESTADOS_INGRESO = ("pago_confirmado", "en_operacion", "completado")


def crear_extraccion_cuenta(db: Session, data, operador):
    cuenta = (
        db.query(MetodoPagoCuenta)
        .filter(
            MetodoPagoCuenta.id == data.cuenta_pago_id,
            MetodoPagoCuenta.activa == True
        )
        .first()
    )
    if not cuenta:
        raise Exception("Cuenta de pago no encontrada o inactiva")

    monto = float(data.monto)
    motivo = data.motivo.strip()
    if monto <= 0:
        raise Exception("El monto de la extraccion debe ser mayor que cero")
    if not motivo:
        raise Exception("El motivo de la extraccion es obligatorio")

    saldos = listar_saldos_cuenta(db, cuenta_pago_id=cuenta.id)
    saldo = saldos[0]["saldo"] if saldos else 0
    if monto > saldo:
        raise Exception("La extraccion supera el saldo disponible de la cuenta")

    extraccion = ExtraccionCuenta(
        cuenta_pago_id=cuenta.id,
        operador_id=operador.id,
        monto=monto,
        motivo=motivo
    )
    db.add(extraccion)
    db.commit()
    db.refresh(extraccion)
    return extraccion


def listar_extracciones_cuenta(
    db: Session,
    cuenta_pago_id: int | None = None,
    limit: int = 100
):
    query = db.query(ExtraccionCuenta)
    if cuenta_pago_id is not None:
        query = query.filter(
            ExtraccionCuenta.cuenta_pago_id == cuenta_pago_id
        )
    return (
        query.order_by(ExtraccionCuenta.created_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )


def listar_saldos_cuenta(
    db: Session,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None
):
    ingresos = (
        db.query(
            Pedido.cuenta_pago_id.label("cuenta_id"),
            func.coalesce(func.sum(Pedido.monto_pago), 0).label("ingresos")
        )
        .filter(
            Pedido.cuenta_pago_id.isnot(None),
            Pedido.estado.in_(ESTADOS_INGRESO)
        )
        .group_by(Pedido.cuenta_pago_id)
        .subquery()
    )
    extracciones = (
        db.query(
            ExtraccionCuenta.cuenta_pago_id.label("cuenta_id"),
            func.coalesce(func.sum(ExtraccionCuenta.monto), 0).label("extracciones")
        )
        .group_by(ExtraccionCuenta.cuenta_pago_id)
        .subquery()
    )
    query = (
        db.query(
            MetodoPagoCuenta,
            MetodoPago,
            func.coalesce(ingresos.c.ingresos, 0),
            func.coalesce(extracciones.c.extracciones, 0)
        )
        .join(MetodoPago, MetodoPagoCuenta.metodo_pago_id == MetodoPago.id)
        .outerjoin(ingresos, ingresos.c.cuenta_id == MetodoPagoCuenta.id)
        .outerjoin(extracciones, extracciones.c.cuenta_id == MetodoPagoCuenta.id)
        .filter(MetodoPagoCuenta.activa == True)
    )
    if metodo_pago_id is not None:
        query = query.filter(MetodoPago.id == metodo_pago_id)
    if cuenta_pago_id is not None:
        query = query.filter(MetodoPagoCuenta.id == cuenta_pago_id)

    resultado = []
    for cuenta, metodo, total_ingresos, total_extracciones in query.all():
        ingresos_valor = float(total_ingresos or 0)
        extracciones_valor = float(total_extracciones or 0)
        resultado.append({
            "cuenta_pago_id": cuenta.id,
            "metodo_pago_id": metodo.id,
            "metodo_pago": metodo.nombre,
            "alias": cuenta.alias,
            "cuenta": cuenta.cuenta,
            "moneda": metodo.moneda,
            "ingresos": ingresos_valor,
            "extracciones": extracciones_valor,
            "saldo": ingresos_valor - extracciones_valor,
        })
    return resultado
