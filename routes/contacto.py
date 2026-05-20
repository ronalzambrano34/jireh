from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from database import get_db

from schemas.contacto import (
    ContactoCreate,
    ContactoResponse,
    ContactoUpdate
)

from services.contacto_service import (
    actualizar_contacto,
    crear_contacto,
    eliminar_contacto,
    listar_contactos,
    obtener_contacto
)

router = APIRouter(
    prefix="/contactos",
    tags=["Contactos"]
)


@router.get(
    "/",
    response_model=list[ContactoResponse]
)
def listar_contactos_route(
    cliente_id: int | None = None,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    db: Session = Depends(
        get_db
    )
):

    return listar_contactos(
        db,
        cliente_id,
        busqueda,
        incluir_inactivos
    )


@router.get(
    "/{contacto_id}",
    response_model=ContactoResponse
)
def obtener_contacto_route(
    contacto_id: int,
    db: Session = Depends(
        get_db
    )
):

    return obtener_contacto(
        db,
        contacto_id
    )


@router.post(
    "/",
    response_model=ContactoResponse
)
def crear_contacto_route(
    data: ContactoCreate,
    db: Session = Depends(
        get_db
    )
):

    return crear_contacto(
        db,
        data
    )


@router.put(
    "/{contacto_id}",
    response_model=ContactoResponse
)
def actualizar_contacto_route(
    contacto_id: int,
    data: ContactoUpdate,
    db: Session = Depends(
        get_db
    )
):

    return actualizar_contacto(
        db,
        contacto_id,
        data
    )


@router.delete(
    "/{contacto_id}",
    response_model=ContactoResponse
)
def eliminar_contacto_route(
    contacto_id: int,
    db: Session = Depends(
        get_db
    )
):

    return eliminar_contacto(
        db,
        contacto_id
    )
