from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_any_permission
)

from Backend.schemas.pedido import (
    PedidoEstadoUpdate
)
from Backend.schemas.pedido_transferencia import (
    PedidoTransferenciaCreate
)

from Backend.services.pedido_service import (
    actualizar_estado_pedido
)
from Backend.services.pedido_service import (
    listar_pedidos
)
from Backend.services.pedido_service import (
    obtener_pedido_por_codigo
)
from Backend.services.pedido_transferencia_service import (
    crear_pedido_transferencia
)

from Backend.services.pedido_creator import (
    crear_pedido
)

router = APIRouter(
    prefix="/pedido",
    tags=["Pedidos"]
)


@router.post(
    "/transferencia"
)
def crear_transferencia(
    data:
    PedidoTransferenciaCreate,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):

    try:
        return (
            crear_pedido_transferencia(
                db,
                data
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.get(
    "/"
)
def listar(
    estado: str | None = None,
    servicio: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    return listar_pedidos(
        db,
        estado=estado,
        servicio=servicio,
        limit=limit,
        offset=offset
    )


@router.get(
    "/{codigo_operacion}"
)
def obtener_por_codigo(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return obtener_pedido_por_codigo(
            db,
            codigo_operacion
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.patch(
    "/{codigo_operacion}/estado"
)
def actualizar_estado(
    codigo_operacion: str,
    data: PedidoEstadoUpdate,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return actualizar_estado_pedido(
            db,
            codigo_operacion,
            data.estado,
            data.comprobante_pago,
            data.observaciones
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.post("/")
def crear(
    data: dict,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):

    return crear_pedido(
        db,
        data
    )

