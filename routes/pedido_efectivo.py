from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db
from services.auth_service import (
    require_any_permission
)

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
        return (
            crear_pedido_efectivo(
                db,
                data
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc