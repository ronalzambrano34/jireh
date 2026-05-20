from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import require_permission
from Backend.services.reporte_service import reporte_general

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
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    estado: str | None = None,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    operador_id: int | None = None,
    db: Session = Depends(
        get_db
    )
):
    return reporte_general(
        db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
        servicio=servicio,
        moneda_pago=moneda_pago,
        operador_id=operador_id
    )
