from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import Form
from fastapi import UploadFile
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_permission
)

from Backend.schemas.archivo_pedido import (
    ArchivoPedidoCreate,
    ArchivoPedidoResponse
)
from Backend.services.archivo_pedido_service import (
    guardar_upload_pedido,
    listar_archivos_pedido,
    registrar_archivo_pedido
)

router = APIRouter(
    prefix="/pedido",
    tags=["Archivos Pedido"],
    dependencies=[
        Depends(
            require_permission(
                "pedidos:gestionar"
            )
        )
    ]
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
    ),
    operador = Depends(
        require_permission(
            "pedidos:gestionar"
        )
    )
):
    try:
        return registrar_archivo_pedido(
            db,
            codigo_operacion,
            data,
            operador=operador
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.post(
    "/{codigo_operacion}/upload",
    response_model=ArchivoPedidoResponse
)
def upload_archivo_route(
    codigo_operacion: str,
    tipo: str = Form(
        ...
    ),
    usuario: str | None = Form(
        default=None
    ),
    notas: str | None = Form(
        default=None
    ),
    archivo: UploadFile = File(
        ...
    ),
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_permission(
            "pedidos:gestionar"
        )
    )
):
    try:
        return guardar_upload_pedido(
            db,
            codigo_operacion,
            tipo,
            archivo,
            usuario=usuario,
            notas=notas,
            operador=operador
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
