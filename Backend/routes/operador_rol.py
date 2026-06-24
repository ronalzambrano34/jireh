from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.schemas.operador_rol import OperadorRolCreate
from Backend.schemas.operador_rol import OperadorRolResponse
from Backend.schemas.operador_rol import OperadorRolUpdate
from Backend.services.auth_service import require_permission
from Backend.services.operador_rol_service import actualizar_rol
from Backend.services.operador_rol_service import crear_rol
from Backend.services.operador_rol_service import eliminar_rol
from Backend.services.operador_rol_service import listar_roles
from Backend.services.operador_rol_service import obtener_rol


router = APIRouter(
    prefix="/operador-roles",
    tags=["Roles de operador"]
)


@router.get("/", response_model=list[OperadorRolResponse])
def listar_roles_route(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("operadores:ver"))
):
    return listar_roles(db, incluir_inactivos=incluir_inactivos)


@router.get("/{rol_id}", response_model=OperadorRolResponse)
def obtener_rol_route(
    rol_id: int,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("operadores:ver"))
):
    try:
        return obtener_rol(db, rol_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/", response_model=OperadorRolResponse)
def crear_rol_route(
    data: OperadorRolCreate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("operadores:crear"))
):
    try:
        return crear_rol(db, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{rol_id}", response_model=OperadorRolResponse)
def actualizar_rol_route(
    rol_id: int,
    data: OperadorRolUpdate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("operadores:editar"))
):
    try:
        return actualizar_rol(db, rol_id, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{rol_id}", response_model=OperadorRolResponse)
def eliminar_rol_route(
    rol_id: int,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("operadores:desactivar"))
):
    try:
        return eliminar_rol(db, rol_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
