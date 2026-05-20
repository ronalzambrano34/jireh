from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.paquete_saldo import (
    PaqueteSaldoCreate,
    PaqueteSaldoResponse,
    PaqueteSaldoUpdate
)
from services.auth_service import require_permission
from services.paquete_saldo_service import (
    actualizar_paquete_saldo,
    crear_paquete_saldo,
    eliminar_paquete_saldo,
    listar_paquetes_saldo,
    obtener_paquete_saldo
)

router = APIRouter(
    prefix="/paquetes-saldo",
    tags=["Paquetes Saldo"],
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
    response_model=list[PaqueteSaldoResponse]
)
def listar_paquetes_saldo_route(
    moneda_pago: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(
        get_db
    )
):
    return listar_paquetes_saldo(
        db,
        moneda_pago=moneda_pago,
        incluir_inactivos=incluir_inactivos,
        limit=limit,
        offset=offset
    )


@router.get(
    "/{paquete_id}",
    response_model=PaqueteSaldoResponse
)
def obtener_paquete_saldo_route(
    paquete_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return obtener_paquete_saldo(
            db,
            paquete_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=PaqueteSaldoResponse
)
def crear_paquete_saldo_route(
    data: PaqueteSaldoCreate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return crear_paquete_saldo(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{paquete_id}",
    response_model=PaqueteSaldoResponse
)
def actualizar_paquete_saldo_route(
    paquete_id: int,
    data: PaqueteSaldoUpdate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return actualizar_paquete_saldo(
            db,
            paquete_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{paquete_id}",
    response_model=PaqueteSaldoResponse
)
def eliminar_paquete_saldo_route(
    paquete_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return eliminar_paquete_saldo(
            db,
            paquete_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
