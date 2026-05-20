from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db
from services.auth_service import (
    require_permission
)

from schemas.cliente import (
    ClienteCreate,
    ClienteResponse,
    ClienteUpdate
)
from schemas.contacto import ContactoResponse

from services.cliente_service import (
    actualizar_cliente,
    buscar_cliente_por_telefono,
    crear_cliente,
    eliminar_cliente,
    listar_clientes,
    listar_contactos_cliente,
    listar_pedidos_cliente,
    obtener_cliente
)

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"],
    dependencies=[
        Depends(
            require_permission(
                "clientes:gestionar"
            )
        )
    ]
)


@router.get(
    "/",
    response_model=list[ClienteResponse]
)
def listar_clientes_route(
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(
        get_db
    )
):
    return listar_clientes(
        db,
        busqueda=busqueda,
        incluir_inactivos=incluir_inactivos,
        limit=limit,
        offset=offset
    )


@router.get(
    "/buscar",
    response_model=ClienteResponse
)
def buscar_cliente_route(
    telefono: str,
    pais: str | None = "br",
    db: Session = Depends(
        get_db
    )
):
    try:
        return buscar_cliente_por_telefono(
            db,
            telefono,
            pais
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.get(
    "/{cliente_id}",
    response_model=ClienteResponse
)
def obtener_cliente_route(
    cliente_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return obtener_cliente(
            db,
            cliente_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.get(
    "/{cliente_id}/contactos",
    response_model=list[ContactoResponse]
)
def listar_contactos_cliente_route(
    cliente_id: int,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    db: Session = Depends(
        get_db
    )
):
    try:
        return listar_contactos_cliente(
            db,
            cliente_id,
            busqueda=busqueda,
            incluir_inactivos=incluir_inactivos
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.get(
    "/{cliente_id}/pedidos"
)
def listar_pedidos_cliente_route(
    cliente_id: int,
    limit: int = 50,
    offset: int = 0,
    incluir_detalle: bool = False,
    db: Session = Depends(
        get_db
    )
):
    try:
        return listar_pedidos_cliente(
            db,
            cliente_id,
            limit=limit,
            offset=offset,
            incluir_detalle=incluir_detalle
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=ClienteResponse
)
def crear_cliente_route(
    data: ClienteCreate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return crear_cliente(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{cliente_id}",
    response_model=ClienteResponse
)
def actualizar_cliente_route(
    cliente_id: int,
    data: ClienteUpdate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return actualizar_cliente(
            db,
            cliente_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{cliente_id}",
    response_model=ClienteResponse
)
def eliminar_cliente_route(
    cliente_id: int,
    db: Session = Depends(
        get_db
    )
):
    try:
        return eliminar_cliente(
            db,
            cliente_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
