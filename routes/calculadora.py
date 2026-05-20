from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import (
    Session
)

from database import (
    get_db
)

from services.calculadora_oferta import (
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
