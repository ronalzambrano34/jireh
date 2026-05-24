from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_any_permission,
    require_permission
)

from Backend.schemas.punto_recogida import (
    PuntoRecogidaCreate,
    PuntoRecogidaResponse,
    PuntoRecogidaUpdate
)
from Backend.services.punto_recogida_service import (
    actualizar_punto_recogida,
    crear_punto_recogida,
    eliminar_punto_recogida,
    listar_puntos_recogida,
    obtener_punto_recogida
)

router = APIRouter(
    prefix="/puntos-recogida",
    tags=["Puntos Recogida"]
)


@router.get(
    "/",
    response_model=list[PuntoRecogidaResponse]
)
def listar_puntos_recogida_route(
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar",
                "empresa:control_total"
            ]
        )
    )
):
    return listar_puntos_recogida(
        db,
        busqueda=busqueda,
        incluir_inactivos=incluir_inactivos,
        limit=limit,
        offset=offset
    )


@router.get(
    "/{punto_id}",
    response_model=PuntoRecogidaResponse
)
def obtener_punto_recogida_route(
    punto_id: int,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar",
                "empresa:control_total"
            ]
        )
    )
):
    try:
        return obtener_punto_recogida(
            db,
            punto_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=PuntoRecogidaResponse
)
def crear_punto_recogida_route(
    data: PuntoRecogidaCreate,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_permission(
            "empresa:control_total"
        )
    )
):
    try:
        return crear_punto_recogida(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{punto_id}",
    response_model=PuntoRecogidaResponse
)
def actualizar_punto_recogida_route(
    punto_id: int,
    data: PuntoRecogidaUpdate,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_permission(
            "empresa:control_total"
        )
    )
):
    try:
        return actualizar_punto_recogida(
            db,
            punto_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{punto_id}",
    response_model=PuntoRecogidaResponse
)
def eliminar_punto_recogida_route(
    punto_id: int,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_permission(
            "empresa:control_total"
        )
    )
):
    try:
        return eliminar_punto_recogida(
            db,
            punto_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
