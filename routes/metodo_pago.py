from fastapi import (
    APIRouter,
    Depends
)

from sqlalchemy.orm import (
    Session
)

from database import (
    get_db
)

from services.metodo_pago_service import (
    listar_metodos_pago
)

router = APIRouter(
    prefix="/metodos-pago",
    tags=["Métodos Pago"]
)


@router.get("/")
def listar(
    moneda: str = None,
    db: Session = Depends(
        get_db
    )
):

    return listar_metodos_pago(
        db,
        moneda
    )