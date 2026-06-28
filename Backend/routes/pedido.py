from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session
from datetime import datetime, timezone

from Backend.database import get_db
from Backend.services.auth_service import (
    require_any_permission
)

from Backend.schemas.pedido import (
    PedidoEstadoUpdate,
    PedidoRedireccionUpdate
)
from Backend.schemas.pedido_transferencia import (
    PedidoTransferenciaCreate
)

from Backend.services.pedido_service import (
    actualizar_estado_pedido,
    liberar_bloqueo_pedido,
    listar_pedidos_activos_por_cliente,
    listar_pedidos,
    obtener_pedido_por_codigo,
    PedidoConflictError,
    PedidoNotFoundError,
    redirigir_pedido_operador,
    renovar_bloqueo_pedido,
    tomar_operacion_pedido
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


def _fecha_utc_sin_zona(value: str | None):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _raise_pedido_http_error(exc: Exception, default_status: int = 400):
    if isinstance(exc, PedidoNotFoundError):
        status_code = 404
    elif isinstance(exc, PermissionError):
        status_code = 403
    elif isinstance(exc, PedidoConflictError):
        status_code = 409
    else:
        status_code = default_status

    raise HTTPException(
        status_code=status_code,
        detail=str(exc)
    ) from exc


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
                "pedidos:ver",
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
    alcance: str = "todas",
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:ver",
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):
    alcance_normalizado = (alcance or "todas").strip().lower()
    if alcance_normalizado not in ("mis", "todas"):
        alcance_normalizado = "todas"
    puede_ver_todas = (
        operador.rol != "cliente"
    )
    if alcance_normalizado == "todas" and not puede_ver_todas:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para ver todas las ordenes"
        )

    try:
        return listar_pedidos(
            db,
            estado=estado,
            servicio=servicio,
            limit=limit,
            offset=offset,
            alcance=alcance_normalizado,
            operador=operador,
            fecha_desde=_fecha_utc_sin_zona(fecha_desde),
            fecha_hasta=_fecha_utc_sin_zona(fecha_hasta)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Rango de fechas invalido"
        ) from exc


@router.get(
    "/rastrear/cliente/{cliente_id}"
)
def rastrear_por_cliente(
    cliente_id: int,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:ver",
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):
    return listar_pedidos_activos_por_cliente(
        db,
        cliente_id
    )


@router.get(
    "/{codigo_operacion}"
)
def obtener_por_codigo(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return obtener_pedido_por_codigo(
            db,
            codigo_operacion,
            operador=operador
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc)
        ) from exc
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
    operador = Depends(
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
            data.observaciones,
            usuario=operador.nombre,
            operador=operador,
            finalizar_sin_comprobante=data.finalizar_sin_comprobante,
            motivo_sin_comprobante=data.motivo_sin_comprobante
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.patch(
    "/{codigo_operacion}/redirigir"
)
def redirigir_operacion(
    codigo_operacion: str,
    data: PedidoRedireccionUpdate,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return redirigir_pedido_operador(
            db,
            codigo_operacion,
            data.operador_destino_id,
            data.mensaje,
            operador
        )
    except Exception as exc:
        _raise_pedido_http_error(exc)


@router.post(
    "/{codigo_operacion}/tomar"
)
def tomar_operacion(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return tomar_operacion_pedido(
            db,
            codigo_operacion,
            operador
        )
    except Exception as exc:
        _raise_pedido_http_error(exc, default_status=409)


@router.post(
    "/{codigo_operacion}/renovar"
)
def renovar_operacion(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return renovar_bloqueo_pedido(
            db,
            codigo_operacion,
            operador
        )
    except Exception as exc:
        _raise_pedido_http_error(exc, default_status=409)


@router.post(
    "/{codigo_operacion}/liberar"
)
def liberar_operacion(
    codigo_operacion: str,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        require_any_permission(
            [
                "pedidos:gestionar"
            ]
        )
    )
):
    try:
        return liberar_bloqueo_pedido(
            db,
            codigo_operacion,
            operador
        )
    except Exception as exc:
        _raise_pedido_http_error(exc, default_status=409)


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

    try:
        return crear_pedido(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc
