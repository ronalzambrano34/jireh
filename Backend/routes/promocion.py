from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.schemas.promocion import PromocionCreate
from Backend.schemas.promocion import PromocionResponse
from Backend.schemas.promocion import PromocionUpdate
from Backend.services.auth_service import require_any_permission
from Backend.services.auth_service import require_permission
from Backend.services.promocion_service import actualizar_promocion
from Backend.services.promocion_service import crear_promocion
from Backend.services.promocion_service import eliminar_promocion
from Backend.services.promocion_service import guardar_imagen_promocion
from Backend.services.promocion_service import listar_promociones
from Backend.services.promocion_service import obtener_promocion

router = APIRouter(prefix="/promociones", tags=["Promociones"])


@router.get("/", response_model=list[PromocionResponse])
def listar_promociones_route(
    busqueda: str | None = None,
    incluir_inactivas: bool = False,
    solo_vigentes: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _operador = Depends(require_any_permission(["pedidos:crear", "pedidos:gestionar", "empresa:control_total"])),
):
    try:
        return listar_promociones(
            db,
            busqueda=busqueda,
            incluir_inactivas=incluir_inactivas,
            solo_vigentes=solo_vigentes,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{promocion_id}", response_model=PromocionResponse)
def obtener_promocion_route(
    promocion_id: int,
    db: Session = Depends(get_db),
    _operador = Depends(require_any_permission(["pedidos:crear", "pedidos:gestionar", "empresa:control_total"])),
):
    try:
        return obtener_promocion(db, promocion_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/", response_model=PromocionResponse)
def crear_promocion_route(
    data: PromocionCreate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total")),
):
    try:
        return crear_promocion(db, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{promocion_id}", response_model=PromocionResponse)
def actualizar_promocion_route(
    promocion_id: int,
    data: PromocionUpdate,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total")),
):
    try:
        return actualizar_promocion(db, promocion_id, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{promocion_id}/imagen", response_model=PromocionResponse)
def subir_imagen_promocion_route(
    promocion_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total")),
):
    try:
        return guardar_imagen_promocion(db, promocion_id, archivo)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{promocion_id}", response_model=PromocionResponse)
def eliminar_promocion_route(
    promocion_id: int,
    db: Session = Depends(get_db),
    _operador = Depends(require_permission("empresa:control_total")),
):
    try:
        return eliminar_promocion(db, promocion_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
