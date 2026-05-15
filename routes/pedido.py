from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db

from schemas.pedido_transferencia import (
    PedidoTransferenciaCreate
)

from services.pedido_transferencia_service import (
    crear_pedido_transferencia
)

router = APIRouter(
    prefix="/pedido",
    tags=["Pedidos"]
)


@router.post(
    "/transferencia"
)
def crear_transferencia(
    data:
    PedidoTransferenciaCreate,
    db: Session = Depends(
        get_db
    )
):

    try:
        return (
            crear_pedido_transferencia(
                db,
                data
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc