from sqlalchemy import func
from sqlalchemy.orm import Session

from Backend.models.pedido import Pedido
from Backend.models.metodo_pago import MetodoPago


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
    fila = query.with_entities(
        func.count(
            Pedido.id
        ).label(
            "total"
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
                Pedido.monto_resultado
            ),
            0
        ).label(
            "monto_resultado"
        ),
        func.coalesce(
            func.sum(
                Pedido.ganancia
            ),
            0
        ).label(
            "ganancia"
        )
    ).one()

    return {
        "total_pedidos": fila.total or 0,
        "monto_pago_total": float(
            fila.monto_pago or 0
        ),
        "monto_resultado_total": float(
            fila.monto_resultado or 0
        ),
        "ganancia_total": float(
            fila.ganancia or 0
        ),
    }


def _agrupar(
    query,
    campo,
    limit: int = 60
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
        .limit(
            limit
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


def _agrupar_por_dia(query, limit: int = 120):
    campo = func.date(
        Pedido.created_at
    )

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
            campo.desc()
        )
        .limit(
            limit
        )
        .all()
    )

    return [
        {
            "clave": str(
                fila.clave
            ),
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


def _agrupar_por_metodo_pago(query, limit: int = 60):
    filas = (
        query.outerjoin(
            MetodoPago,
            Pedido.tipo_pago_id == MetodoPago.id
        )
        .with_entities(
            func.coalesce(
                MetodoPago.nombre,
                "Sin metodo"
            ).label(
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
            MetodoPago.nombre
        )
        .order_by(
            func.count(
                Pedido.id
            ).desc()
        )
        .limit(
            limit
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
        "por_metodo_pago": _agrupar_por_metodo_pago(
            query
        ),
        "por_dia": _agrupar_por_dia(
            query
        ),
    }
