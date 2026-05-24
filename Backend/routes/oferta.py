from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.schemas.oferta import (
    OfertaCreate,
    OfertaResponse,
    OfertaUpdate
)
from Backend.services.auth_service import require_permission
from Backend.services.oferta_service import (
    actualizar_oferta,
    crear_oferta,
    eliminar_oferta,
    listar_ofertas,
    obtener_oferta
)

router = APIRouter(
    prefix="/ofertas",
    tags=["Ofertas"],
    dependencies=[
        Depends(
            require_permission(
                "empresa:control_total"
            )
        )
    ]
)


@router.get(
    "/",
    response_model=list[OfertaResponse]
)
def listar_ofertas_route(
    servicio: str | None = None,
    moneda_pago: str | None = None,
    incluir_inactivas: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(
        get_db
    )
):
    return listar_ofertas(
        db,
        servicio=servicio,
        moneda_pago=moneda_pago,
        incluir_inactivas=incluir_inactivas,
        limit=limit,
        offset=offset
    )


@router.get(
    "/{oferta_id}",
    response_model=OfertaResponse
)
def obtener_oferta_route(
    oferta_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return obtener_oferta(
            db,
            oferta_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=OfertaResponse
)
def crear_oferta_route(
    data: OfertaCreate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return crear_oferta(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{oferta_id}",
    response_model=OfertaResponse
)
def actualizar_oferta_route(
    oferta_id: int,
    data: OfertaUpdate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return actualizar_oferta(
            db,
            oferta_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{oferta_id}",
    response_model=OfertaResponse
)
def eliminar_oferta_route(
    oferta_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return eliminar_oferta(
            db,
            oferta_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
