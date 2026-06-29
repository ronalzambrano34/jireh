from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import (
    require_permission
)
from Backend.schemas.configuracion import ConfiguracionCreate
from Backend.schemas.configuracion import ConfiguracionBase
from Backend.schemas.configuracion import ConfiguracionResponse
from Backend.schemas.configuracion import ConfiguracionUpdate
from Backend.services.configuracion_service import (
    DEFAULT_ACTIVE_PHONE_CODES_VALUE,
    PHONE_CODES_CONFIG_KEY,
    crear_o_actualizar_configuracion
)
from Backend.services.configuracion_service import (
    listar_configuraciones
)
from Backend.services.configuracion_service import (
    obtener_configuracion
)
from Backend.services.configuracion_service import (
    obtener_valor_configuracion
)

public_router = APIRouter(
    prefix="/configuracion-publica",
    tags=["Configuracion"]
)


@public_router.get(
    "/codigos-pais",
    response_model=ConfiguracionBase
)
def obtener_codigos_pais_publicos(
    db: Session = Depends(
        get_db
    )
):
    return {
        "clave": PHONE_CODES_CONFIG_KEY,
        "valor": obtener_valor_configuracion(
            db,
            PHONE_CODES_CONFIG_KEY,
            DEFAULT_ACTIVE_PHONE_CODES_VALUE
        )
    }

router = APIRouter(
    prefix="/configuracion",
    tags=["Configuracion"],
    dependencies=[
        Depends(
            require_permission(
                "configuracion:gestionar"
            )
        )
    ]
)


@router.get(
    "/",
    response_model=list[ConfiguracionResponse]
)
def listar_configuraciones_route(
    db: Session = Depends(
        get_db
    )
):
    return listar_configuraciones(
        db
    )


@router.get(
    "/{clave}",
    response_model=ConfiguracionResponse
)
def obtener_por_clave(
    clave: str,
    db: Session = Depends(
        get_db
    )
):
    configuracion = obtener_configuracion(
        db,
        clave
    )

    if not configuracion:
        raise HTTPException(
            status_code=404,
            detail="Configuracion no encontrada"
        )

    return configuracion


@router.post(
    "/",
    response_model=ConfiguracionResponse
)
def crear_configuracion(
    data: ConfiguracionCreate,
    db: Session = Depends(
        get_db
    )
):
    return crear_o_actualizar_configuracion(
        db,
        data.clave,
        data.valor
    )


@router.put(
    "/{clave}",
    response_model=ConfiguracionResponse
)
def actualizar_configuracion(
    clave: str,
    data: ConfiguracionUpdate,
    db: Session = Depends(
        get_db
    )
):
    return crear_o_actualizar_configuracion(
        db,
        clave,
        data.valor
    )
