from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import File
from fastapi import UploadFile

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_any_permission,
    require_permission
)

from Backend.schemas.metodo_pago import (
    MetodoPagoCreate,
    MetodoPagoResponse,
    MetodoPagoUpdate
)
from Backend.schemas.metodo_pago_cuenta import (
    MetodoPagoCuentaCreate,
    MetodoPagoCuentaResponse,
    MetodoPagoCuentaUpdate
)
from Backend.services.metodo_pago_service import (
    actualizar_metodo_pago,
    crear_metodo_pago,
    eliminar_metodo_pago,
    listar_metodos_pago,
    obtener_metodo_pago,
    guardar_imagen_metodo_pago,
    actualizar_cuenta_metodo_pago,
    crear_cuenta_metodo_pago,
    eliminar_cuenta_metodo_pago,
    listar_cuentas_metodo_pago
)

router = APIRouter(
    prefix="/metodos-pago",
    tags=["Metodos Pago"]
)


@router.get(
    "/",
    response_model=list[MetodoPagoResponse]
)
def listar_metodos_pago_route(
    moneda: str | None = None,
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
                "reportes:ver",
                "empresa:control_total"
            ]
        )
    )
):
    try:
        return listar_metodos_pago(
            db,
            moneda=moneda,
            busqueda=busqueda,
            incluir_inactivos=incluir_inactivos,
            limit=limit,
            offset=offset
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.get(
    "/{metodo_id}",
    response_model=MetodoPagoResponse
)
def obtener_metodo_pago_route(
    metodo_id: int,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar",
                "reportes:ver",
                "empresa:control_total"
            ]
        )
    )
):
    try:
        return obtener_metodo_pago(
            db,
            metodo_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc


@router.post(
    "/",
    response_model=MetodoPagoResponse
)
def crear_metodo_pago_route(
    data: MetodoPagoCreate,
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
        return crear_metodo_pago(
            db,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{metodo_id}",
    response_model=MetodoPagoResponse
)
def actualizar_metodo_pago_route(
    metodo_id: int,
    data: MetodoPagoUpdate,
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
        return actualizar_metodo_pago(
            db,
            metodo_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc




@router.post(
    "/{metodo_id}/imagen",
    response_model=MetodoPagoResponse
)
def subir_imagen_metodo_pago_route(
    metodo_id: int,
    archivo: UploadFile = File(
        ...
    ),
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
        return guardar_imagen_metodo_pago(
            db,
            metodo_id,
            archivo
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{metodo_id}",
    response_model=MetodoPagoResponse
)
def eliminar_metodo_pago_route(
    metodo_id: int,
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
        return eliminar_metodo_pago(
            db,
            metodo_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc



@router.get(
    "/{metodo_id}/cuentas",
    response_model=list[MetodoPagoCuentaResponse]
)
def listar_cuentas_metodo_pago_route(
    metodo_id: int,
    incluir_inactivas: bool = True,
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar",
                "reportes:ver",
                "empresa:control_total"
            ]
        )
    )
):
    try:
        return listar_cuentas_metodo_pago(
            db,
            metodo_id,
            incluir_inactivas=incluir_inactivas
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.post(
    "/{metodo_id}/cuentas",
    response_model=MetodoPagoCuentaResponse
)
def crear_cuenta_metodo_pago_route(
    metodo_id: int,
    data: MetodoPagoCuentaCreate,
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
        return crear_cuenta_metodo_pago(
            db,
            metodo_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.put(
    "/{metodo_id}/cuentas/{cuenta_id}",
    response_model=MetodoPagoCuentaResponse
)
def actualizar_cuenta_metodo_pago_route(
    metodo_id: int,
    cuenta_id: int,
    data: MetodoPagoCuentaUpdate,
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
        return actualizar_cuenta_metodo_pago(
            db,
            metodo_id,
            cuenta_id,
            data
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.delete(
    "/{metodo_id}/cuentas/{cuenta_id}",
    response_model=MetodoPagoCuentaResponse
)
def eliminar_cuenta_metodo_pago_route(
    metodo_id: int,
    cuenta_id: int,
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
        return eliminar_cuenta_metodo_pago(
            db,
            metodo_id,
            cuenta_id
        )
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        ) from exc
