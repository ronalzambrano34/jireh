from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db
from schemas.pedido_divisa import PedidoDivisaCreate
from services.pedido_divisa_service import crear_pedido_divisa

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
