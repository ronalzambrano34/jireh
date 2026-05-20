from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db

from schemas.archivo_pedido import (
    ArchivoPedidoCreate,
    ArchivoPedidoResponse
)
from services.archivo_pedido_service import (
    listar_archivos_pedido,
    registrar_archivo_pedido
)

router = APIRouter(
    prefix="/pedido",
    tags=["Archivos Pedido"]
)


@router.get(
    "/{codigo_operacion}/archivos",
    response_model=list[ArchivoPedidoResponse]
)
def listar_archivos_route(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    )
):
    try:
        return listar_archivos_pedido(
            db,
            codigo_operacion
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/{codigo_operacion}/archivos",
    response_model=ArchivoPedidoResponse
)
def registrar_archivo_route(
    codigo_operacion: str,
    data: ArchivoPedidoCreate,
    db: Session = Depends(
        get_db
    )
):
    try:
        return registrar_archivo_pedido(
            db,
            codigo_operacion,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
