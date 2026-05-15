from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from database import get_db

from schemas.pedido_efectivo import (
    PedidoEfectivoCreate
)

from services.pedido_efectivo_service import (
    crear_pedido_efectivo
)

router = APIRouter(
    prefix="/pedido",
    tags=["Pedidos"]
)


@router.post(
    "/efectivo"
)
def crear_efectivo(
    data:
    PedidoEfectivoCreate,
    db: Session = Depends(
        get_db
    )
):

    return (
        crear_pedido_efectivo(
            db,
            data
        )
    )