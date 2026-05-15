from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from database import get_db

from schemas.operador import (
    OperadorCreate
)

from services.operador_service import (
    crear_operador
)

router = APIRouter(
    prefix="/operador",
    tags=["Operadores"]
)


@router.post("/")
def crear_operador_route(
    data: OperadorCreate,
    db: Session = Depends(
        get_db
    )
):

    return crear_operador(
        db,
        data
    )