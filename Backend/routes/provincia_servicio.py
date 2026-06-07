from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.schemas.provincia_servicio import (
    ProvinciaServicioCreate,
    ProvinciaServicioResponse,
    ProvinciaServicioUpdate
)
from Backend.services.auth_service import require_permission
from Backend.services.provincia_servicio_service import (
    actualizar_provincia_servicio,
    crear_provincia_servicio,
    listar_provincias_servicio
)

router = APIRouter(
    prefix="/provincias-servicio",
    tags=["Provincias Servicio"]
)


@router.get(
    "/",
    response_model=list[ProvinciaServicioResponse]
)
def listar_provincias_servicio_route(
    incluir_inactivas: bool = True,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total"))
):
    return listar_provincias_servicio(
        db,
        incluir_inactivas=incluir_inactivas
    )


@router.post(
    "/",
    response_model=ProvinciaServicioResponse
)
def crear_provincia_servicio_route(
    data: ProvinciaServicioCreate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total"))
):
    try:
        return crear_provincia_servicio(db, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/{provincia_id}",
    response_model=ProvinciaServicioResponse
)
def actualizar_provincia_servicio_route(
    provincia_id: int,
    data: ProvinciaServicioUpdate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total"))
):
    try:
        return actualizar_provincia_servicio(db, provincia_id, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
