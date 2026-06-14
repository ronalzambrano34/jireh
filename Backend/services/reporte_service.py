from sqlalchemy import String
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import select
from sqlalchemy import union_all
from sqlalchemy.orm import Session

from Backend.models.metodo_pago import MetodoPago
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.operador import Operador
from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa


def _filtros_reporte(
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None,
    campo_fecha=None
):
    filtros = []
    campo_fecha = campo_fecha if campo_fecha is not None else Pedido.created_at

    if fecha_desde:
        filtros.append(
            campo_fecha >= fecha_desde
        )

    if fecha_hasta:
        filtros.append(
            campo_fecha <= fecha_hasta
        )

    if estado:
        filtros.append(
            Pedido.estado == estado.strip()
        )

    if servicio:
        filtros.append(
            Pedido.servicio == servicio.strip().lower()
        )

    if moneda_pago:
        filtros.append(
            Pedido.moneda_pago == moneda_pago.strip().upper()
        )

    if operador_id is not None:
        filtros.append(
            Pedido.operador_id == operador_id
        )

    if metodo_pago_id is not None:
        filtros.append(
            Pedido.tipo_pago_id == metodo_pago_id
        )

    if cuenta_pago_id is not None:
        filtros.append(
            Pedido.cuenta_pago_id == cuenta_pago_id
        )

    return filtros


def historial_operaciones(
    db: Session,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None
):
    fecha_operacion = func.coalesce(
        Pedido.fecha_completado,
        Pedido.created_at
    )
    filtros = _filtros_reporte(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id,
        metodo_pago_id=metodo_pago_id,
        cuenta_pago_id=cuenta_pago_id,
        campo_fecha=fecha_operacion
    )

    filas = (
        db.query(
            Pedido,
            Operador.nombre.label("operador_nombre"),
            MetodoPago.nombre.label("metodo_pago_nombre"),
            MetodoPagoCuenta.alias.label("cuenta_alias"),
            PedidoDivisa.tipo_tarjeta.label("tipo_divisa")
        )
        .outerjoin(
            Operador,
            Pedido.operador_id == Operador.id
        )
        .outerjoin(
            MetodoPago,
            Pedido.tipo_pago_id == MetodoPago.id
        )
        .outerjoin(
            MetodoPagoCuenta,
            Pedido.cuenta_pago_id == MetodoPagoCuenta.id
        )
        .outerjoin(
            PedidoDivisa,
            PedidoDivisa.pedido_id == Pedido.id
        )
        .filter(
            *filtros
        )
        .order_by(
            fecha_operacion.asc(),
            Pedido.id.asc()
        )
        .all()
    )

    resultado = []
    for pedido, operador, metodo, cuenta, tipo_divisa in filas:
        fecha = pedido.fecha_completado or pedido.created_at
        servicio_actual = (pedido.servicio or "").strip().lower()
        tipo_divisa_actual = (tipo_divisa or "").strip().lower()
        montos = {
            "transferencia_cup": None,
            "usd": None,
            "efectivo_cup": None,
            "mlc": None,
            "recarga": None,
            "otros": None,
        }

        if servicio_actual == "transferencia":
            montos["transferencia_cup"] = pedido.monto_resultado
        elif servicio_actual == "efectivo":
            montos["efectivo_cup"] = pedido.monto_resultado
        elif servicio_actual == "saldo":
            montos["recarga"] = pedido.monto_resultado
        elif servicio_actual == "divisa":
            if "mlc" in tipo_divisa_actual:
                montos["mlc"] = pedido.monto_resultado
            else:
                montos["usd"] = pedido.monto_resultado
        else:
            montos["otros"] = pedido.monto_resultado

        resultado.append({
            "fecha": fecha,
            "codigo": pedido.codigo_operacion,
            "gestor": operador or "Sin operador",
            "banco": " - ".join(
                valor
                for valor in [metodo, cuenta]
                if valor
            ) or "Sin metodo",
            "moneda": pedido.moneda_pago,
            "monto_pago": float(pedido.monto_pago or 0),
            "tasa": float(
                pedido.monto_pago
                if pedido.servicio == "saldo"
                else pedido.tasa_final or 0
            ),
            **montos,
            "ganancia": float(pedido.ganancia or 0),
            "estado": pedido.estado,
            "observaciones": pedido.observaciones,
        })

    return resultado


def _consulta_agregada(
    seccion: str,
    filtros,
    campo=None,
    incluir_monto_resultado: bool = False,
    unir_metodo_pago: bool = False,
    unir_cuenta_pago: bool = False
):
    clave = (
        cast(
            campo,
            String
        )
        if campo is not None
        else cast(
            literal(None),
            String
        )
    )

    consulta = select(
        literal(
            seccion
        ).label(
            "seccion"
        ),
        clave.label(
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
        (
            func.coalesce(
                func.sum(
                    Pedido.monto_resultado
                ),
                0
            )
            if incluir_monto_resultado
            else literal(0)
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
    ).select_from(
        Pedido
    )

    if unir_metodo_pago:
        consulta = consulta.outerjoin(
            MetodoPago,
            Pedido.tipo_pago_id == MetodoPago.id
        )

    if unir_cuenta_pago:
        consulta = consulta.outerjoin(
            MetodoPagoCuenta,
            Pedido.cuenta_pago_id == MetodoPagoCuenta.id
        ).outerjoin(
            MetodoPago,
            Pedido.tipo_pago_id == MetodoPago.id
        )

    if filtros:
        consulta = consulta.where(
            *filtros
        )

    if campo is not None:
        consulta = consulta.group_by(
            campo
        )

    return consulta


def _fila_grupo(fila):
    clave = fila.clave

    if (
        fila.seccion == "por_operador"
        and clave is not None
    ):
        clave = int(
            clave
        )

    return {
        "clave": clave,
        "cantidad": fila.cantidad,
        "monto_pago": float(
            fila.monto_pago or 0
        ),
        "ganancia": float(
            fila.ganancia or 0
        ),
    }


def reporte_general(
    db: Session,
    fecha_desde=None,
    fecha_hasta=None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None
):
    filtros = _filtros_reporte(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id,
        metodo_pago_id=metodo_pago_id,
        cuenta_pago_id=cuenta_pago_id
    )
    metodo_pago = func.coalesce(
        MetodoPago.nombre,
        "Sin metodo"
    )
    dia = func.date(
        Pedido.created_at
    )
    cuenta_pago = func.coalesce(
        MetodoPago.nombre + " - " + MetodoPagoCuenta.alias,
        MetodoPago.nombre + " - Sin cuenta",
        "Sin cuenta"
    )

    consulta = union_all(
        _consulta_agregada(
            "resumen",
            filtros,
            incluir_monto_resultado=True
        ),
        _consulta_agregada(
            "por_estado",
            filtros,
            Pedido.estado
        ),
        _consulta_agregada(
            "por_servicio",
            filtros,
            Pedido.servicio
        ),
        _consulta_agregada(
            "por_moneda",
            filtros,
            Pedido.moneda_pago
        ),
        _consulta_agregada(
            "por_operador",
            filtros,
            Pedido.operador_id
        ),
        _consulta_agregada(
            "por_metodo_pago",
            filtros,
            metodo_pago,
            unir_metodo_pago=True
        ),
        _consulta_agregada(
            "por_cuenta_pago",
            filtros,
            cuenta_pago,
            unir_cuenta_pago=True
        ),
        _consulta_agregada(
            "por_dia",
            filtros,
            dia
        )
    )

    filas = db.execute(
        consulta
    ).all()
    reporte = {
        "resumen": {
            "total_pedidos": 0,
            "monto_pago_total": 0.0,
            "monto_resultado_total": 0.0,
            "ganancia_total": 0.0,
        },
        "por_estado": [],
        "por_servicio": [],
        "por_moneda": [],
        "por_operador": [],
        "por_metodo_pago": [],
        "por_cuenta_pago": [],
        "por_dia": [],
    }

    for fila in filas:
        if fila.seccion == "resumen":
            reporte["resumen"] = {
                "total_pedidos": fila.cantidad or 0,
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
            continue

        reporte[fila.seccion].append(
            _fila_grupo(
                fila
            )
        )

    for seccion in [
        "por_estado",
        "por_servicio",
        "por_moneda",
        "por_operador",
        "por_metodo_pago",
        "por_cuenta_pago",
    ]:
        reporte[seccion].sort(
            key=lambda fila: fila["cantidad"],
            reverse=True
        )
        reporte[seccion] = reporte[seccion][
            :60
        ]

    reporte["por_dia"].sort(
        key=lambda fila: fila["clave"] or "",
        reverse=True
    )
    reporte["por_dia"] = reporte["por_dia"][
        :120
    ]

    return reporte
