from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db

from schemas.operador import (
    OperadorCreate,
    OperadorResponse,
    OperadorUpdate
)

from services.operador_service import (
    actualizar_operador,
    crear_operador,
    eliminar_operador,
    listar_operadores,
    obtener_operador
)

router = APIRouter(
    prefix="/operador",
    tags=["Operadores"]
)


@router.get(
    "/",
    response_model=list[OperadorResponse]
)
def listar_operadores_route(
    busqueda: str | None = None,
    rol: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(
        get_db
    )
):
    try:
        return listar_operadores(
            db,
            busqueda=busqueda,
            rol=rol,
            incluir_inactivos=incluir_inactivos,
            limit=limit,
            offset=offset
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.get(
    "/{operador_id}",
    response_model=OperadorResponse
)
def obtener_operador_route(
    operador_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return obtener_operador(
            db,
            operador_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=OperadorResponse
)
def crear_operador_route(
    data: OperadorCreate,
    db: Session = Depends(
        get_db
    )
):

    try:
        return crear_operador(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{operador_id}",
    response_model=OperadorResponse
)
def actualizar_operador_route(
    operador_id: int,
    data: OperadorUpdate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return actualizar_operador(
            db,
            operador_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{operador_id}",
    response_model=OperadorResponse
)
def eliminar_operador_route(
    operador_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return eliminar_operador(
            db,
            operador_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
