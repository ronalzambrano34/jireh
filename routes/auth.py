from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from database import get_db

from schemas.auth import (
    AuthOperadorResponse,
    BootstrapAdminRequest,
    LoginRequest,
    TokenResponse
)
from services.auth_service import (
    bootstrap_admin,
    get_current_operador,
    login_operador
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
