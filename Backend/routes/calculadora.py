from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import (
    Session
)

from Backend.database import (
    get_db
)
from Backend.services.auth_service import (
    require_any_permission
)

from Backend.services.calculadora_oferta import (
    calcular_operacion
)

router = APIRouter(
    prefix="/calculadora",
    tags=["Calculadora"]
)


@router.post("/")
def calcular(
    data: dict,
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
        return calcular_operacion(
            db=db,
            servicio=
            data["servicio"],

            moneda_pago=
            data["moneda_pago"],

            monto_pago=
            data["monto_pago"]
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
