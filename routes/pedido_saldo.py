from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db
from schemas.pedido_saldo import PedidoSaldoCreate
from services.pedido_saldo_service import crear_pedido_saldo

router = APIRouter(
    prefix="/pedido",
    tags=["Pedidos"]
)


@router.post(
    "/saldo"
)
def crear_saldo(
    data: PedidoSaldoCreate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return crear_pedido_saldo(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
