import csv
from io import StringIO
from datetime import date
from datetime import datetime
from datetime import time

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import require_permission
from Backend.services.reporte_service import reporte_general
from Backend.schemas.extraccion_cuenta import ExtraccionCuentaCreate
from Backend.services.cuenta_service import (
    crear_extraccion_cuenta,
    listar_extracciones_cuenta,
    listar_saldos_cuenta
)


def _normalizar_fecha_desde(value: date | None):
    if value is None:
        return None
    return datetime.combine(
        value,
        time.min
    )


def _normalizar_fecha_hasta(value: date | None):
    if value is None:
        return None
    return datetime.combine(
        value,
        time.max
    )


router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"],
    dependencies=[
        Depends(
            require_permission(
                "pedidos:gestionar"
            )
        )
    ]
)


@router.get(
    "/resumen"
)
def resumen_route(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None,
    db: Session = Depends(
        get_db
    )
):
    return reporte_general(
        db,
        fecha_desde=_normalizar_fecha_desde(fecha_desde),
        fecha_hasta=_normalizar_fecha_hasta(fecha_hasta),
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id,
        metodo_pago_id=metodo_pago_id,
        cuenta_pago_id=cuenta_pago_id
    )


@router.get(
    "/resumen.csv"
)
def resumen_csv_route(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None,
    db: Session = Depends(
        get_db
    )
):
    reporte = reporte_general(
        db,
        fecha_desde=_normalizar_fecha_desde(fecha_desde),
        fecha_hasta=_normalizar_fecha_hasta(fecha_hasta),
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id,
        metodo_pago_id=metodo_pago_id,
        cuenta_pago_id=cuenta_pago_id
    )

    output = StringIO()
    writer = csv.writer(
        output
    )
    writer.writerow(
        [
            "seccion",
            "clave",
            "cantidad",
            "monto_pago",
            "ganancia"
        ]
    )

    resumen = reporte[
        "resumen"
    ]
    writer.writerow(
        [
            "resumen",
            "total",
            resumen[
                "total_pedidos"
            ],
            resumen[
                "monto_pago_total"
            ],
            resumen[
                "ganancia_total"
            ]
        ]
    )

    for seccion in [
        "por_dia",
        "por_estado",
        "por_servicio",
        "por_moneda",
        "por_metodo_pago",
        "por_cuenta_pago",
        "por_operador"
    ]:
        for fila in reporte[
            seccion
        ]:
            writer.writerow(
                [
                    seccion,
                    fila[
                        "clave"
                    ],
                    fila[
                        "cantidad"
                    ],
                    fila[
                        "monto_pago"
                    ],
                    fila[
                        "ganancia"
                    ]
                ]
            )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=reporte_resumen.csv"
        }
    )


@router.get("/cuentas/saldos")
def saldos_cuenta_route(
    metodo_pago_id: int | None = None,
    cuenta_pago_id: int | None = None,
    db: Session = Depends(get_db)
):
    return listar_saldos_cuenta(
        db,
        metodo_pago_id=metodo_pago_id,
        cuenta_pago_id=cuenta_pago_id
    )


@router.get("/extracciones")
def extracciones_cuenta_route(
    cuenta_pago_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return listar_extracciones_cuenta(
        db,
        cuenta_pago_id=cuenta_pago_id,
        limit=limit
    )


@router.post("/extracciones")
def crear_extraccion_cuenta_route(
    data: ExtraccionCuentaCreate,
    db: Session = Depends(get_db),
    operador = Depends(require_permission("pedidos:gestionar"))
):
    try:
        return crear_extraccion_cuenta(db, data, operador)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
