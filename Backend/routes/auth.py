from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from Backend.database import get_db

from Backend.schemas.auth import (
    AuthOperadorResponse,
    BootstrapAdminRequest,
    LoginRequest,
    PasswordChangeRequest,
    PerfilUpdateRequest,
    TokenResponse
)
from Backend.services.auth_service import (
    bootstrap_admin,
    get_current_operador,
    hash_password,
    login_operador,
    verificar_password
)

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


@router.post(
    "/bootstrap",
    response_model=TokenResponse
)
def bootstrap_admin_route(
    data: BootstrapAdminRequest,
    db: Session = Depends(
        get_db
    )
):
    try:
        return bootstrap_admin(
            db,
            data.nombre,
            data.telefono,
            data.password
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc


@router.post(
    "/login",
    response_model=TokenResponse
)
def login_route(
    data: LoginRequest,
    db: Session = Depends(
        get_db
    )
):
    try:
        return login_operador(
            db,
            data.telefono,
            data.password
        )
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc)
        ) from exc


@router.get(
    "/me",
    response_model=AuthOperadorResponse
)
def me_route(
    operador = Depends(
        get_current_operador
    )
):
    return {
        "operador": operador
    }



@router.put(
    "/me",
    response_model=AuthOperadorResponse
)
def actualizar_me_route(
    data: PerfilUpdateRequest,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        get_current_operador
    )
):
    nombre = data.nombre.strip()
    if not nombre:
        raise HTTPException(
            status_code=400,
            detail="El nombre no puede estar vacio"
        )

    operador.nombre = nombre
    db.commit()
    db.refresh(
        operador
    )
    return {
        "operador": operador
    }


@router.patch(
    "/me/password"
)
def cambiar_password_me_route(
    data: PasswordChangeRequest,
    db: Session = Depends(
        get_db
    ),
    operador = Depends(
        get_current_operador
    )
):
    if not verificar_password(
        data.password_actual,
        operador.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="La contrasena actual no coincide"
        )

    try:
        operador.password_hash = hash_password(
            data.password_nueva
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(
                exc
            )
        ) from exc

    db.commit()
    return {
        "message": "Contrasena actualizada"
    }
