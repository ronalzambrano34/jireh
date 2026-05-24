from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_any_permission
)
from Backend.schemas.pedido_divisa import PedidoDivisaCreate
from Backend.services.pedido_divisa_service import crear_pedido_divisa

router = APIRouter(
    prefix="/pedido",
    tags=["Pedidos"]
)


@router.post(
    "/divisa"
)
def crear_divisa(
    data: PedidoDivisaCreate,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return crear_pedido_divisa(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
