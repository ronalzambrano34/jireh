from sqlalchemy import func
from sqlalchemy.orm import Session

from Backend.models.pedido import Pedido


def _query_pedidos(
    db: Session,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None
):
    query = db.query(
        Pedido
    )

    if fecha_desde:
        query = query.filter(
            Pedido.created_at >= fecha_desde
        )

    if fecha_hasta:
        query = query.filter(
            Pedido.created_at <= fecha_hasta
        )

    if estado:
        query = query.filter(
            Pedido.estado == estado.strip()
        )

    if servicio:
        query = query.filter(
            Pedido.servicio == servicio.strip().lower()
        )

    if moneda_pago:
        query = query.filter(
            Pedido.moneda_pago == moneda_pago.strip().upper()
        )

    if operador_id is not None:
        query = query.filter(
            Pedido.operador_id == operador_id
        )

    return query


def resumen_pedidos(
    query
):
    total = query.with_entities(
        func.count(
            Pedido.id
        )
    ).scalar() or 0

    monto_pago = query.with_entities(
        func.coalesce(
            func.sum(
                Pedido.monto_pago
            ),
            0
        )
    ).scalar() or 0

    monto_resultado = query.with_entities(
        func.coalesce(
            func.sum(
                Pedido.monto_resultado
            ),
            0
        )
    ).scalar() or 0

    ganancia = query.with_entities(
        func.coalesce(
            func.sum(
                Pedido.ganancia
            ),
            0
        )
    ).scalar() or 0

    return {
        "total_pedidos": total,
        "monto_pago_total": float(
            monto_pago
        ),
        "monto_resultado_total": float(
            monto_resultado
        ),
        "ganancia_total": float(
            ganancia
        ),
    }


def _agrupar(
    query,
    campo
):
    filas = (
        query.with_entities(
            campo.label(
                "clave"
            ),
            func.count(
                Pedido.id
            ).label(
                "cantidad"
            ),
            func.coalesce(
                func.sum(
                    Pedido.monto_pago
                ),
                0
            ).label(
                "monto_pago"
            ),
            func.coalesce(
                func.sum(
                    Pedido.ganancia
                ),
                0
            ).label(
                "ganancia"
            )
        )
        .group_by(
            campo
        )
        .order_by(
            func.count(
                Pedido.id
            ).desc()
        )
        .all()
    )

    return [
        {
            "clave": fila.clave,
            "cantidad": fila.cantidad,
            "monto_pago": float(
                fila.monto_pago
            ),
            "ganancia": float(
                fila.ganancia
            ),
        }
        for fila in filas
    ]


def reporte_general(
    db: Session,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None
):
    query = _query_pedidos(
        db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id
    )

    return {
        "resumen": resumen_pedidos(
            query
        ),
        "por_estado": _agrupar(
            query,
            Pedido.estado
        ),
        "por_servicio": _agrupar(
            query,
            Pedido.servicio
        ),
        "por_moneda": _agrupar(
            query,
            Pedido.moneda_pago
        ),
        "por_operador": _agrupar(
            query,
            Pedido.operador_id
        ),
    }
