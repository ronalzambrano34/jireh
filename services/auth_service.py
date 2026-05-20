import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from config import AUTH_SECRET
from config import AUTH_TOKEN_MINUTES
from database import get_db
from models.operador import Operador
from schemas.operador import ROLES_OPERADOR
from services.generador_operador import generar_codigo_operador

security = HTTPBearer(
    auto_error=False
)


def _b64encode(
    data: bytes
):
    return (
        base64.urlsafe_b64encode(
            data
        )
        .rstrip(
            b"="
        )
        .decode(
            "ascii"
        )
    )


def _b64decode(
    data: str
):
    padding = "=" * (
        -len(data) % 4
    )
    return base64.urlsafe_b64decode(
        data + padding
    )


def hash_password(
    password: str
):
    if not password or len(password) < 6:
        raise Exception(
            "La contraseña debe tener al menos 6 caracteres"
        )

    salt = os.urandom(
        16
    )
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(
            "utf-8"
        ),
        salt,
        120000
    )

    return (
        "pbkdf2_sha256$120000$"
        + _b64encode(
            salt
        )
        + "$"
        + _b64encode(
            digest
        )
    )


def verificar_password(
    password: str,
    password_hash: str | None
):
    if not password_hash:
        return False

    try:
        algoritmo, iteraciones, salt, digest = (
            password_hash.split(
                "$"
            )
        )
    except ValueError:
        return False

    if algoritmo != "pbkdf2_sha256":
        return False

    nuevo_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(
            "utf-8"
        ),
        _b64decode(
            salt
        ),
        int(
            iteraciones
        )
    )

    return hmac.compare_digest(
        _b64encode(
            nuevo_digest
        ),
        digest
    )


def _firmar(
    payload_b64: str
):
    return _b64encode(
        hmac.new(
            AUTH_SECRET.encode(
                "utf-8"
            ),
            payload_b64.encode(
                "ascii"
            ),
            hashlib.sha256
        ).digest()
    )


def crear_token_operador(
    operador: Operador
):
    payload = {
        "sub": operador.id,
        "rol": operador.rol,
        "exp": int(
            time.time()
        )
        +
        (
            AUTH_TOKEN_MINUTES
            *
            60
        )
    }
    payload_b64 = _b64encode(
        json.dumps(
            payload,
            separators=(
                ",",
                ":"
            )
        ).encode(
            "utf-8"
        )
    )
    return (
        payload_b64
        + "."
        + _firmar(
            payload_b64
        )
    )


def decodificar_token(
    token: str
):
    try:
        payload_b64, firma = token.split(
            ".",
            1
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Token invalido"
        )

    firma_esperada = _firmar(
        payload_b64
    )

    if not hmac.compare_digest(
        firma,
        firma_esperada
    ):
        raise HTTPException(
            status_code=401,
            detail="Token invalido"
        )

    payload = json.loads(
        _b64decode(
            payload_b64
        ).decode(
            "utf-8"
        )
    )

    if payload.get(
        "exp",
        0
    ) < int(
        time.time()
    ):
        raise HTTPException(
            status_code=401,
            detail="Token expirado"
        )

    return payload


def login_operador(
    db: Session,
    telefono: str,
    password: str
):
    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            ==
            telefono,
            Operador.activo
            ==
            True
        )
        .first()
    )

    if not operador or not verificar_password(
        password,
        operador.password_hash
    ):
        raise Exception(
            "Credenciales invalidas"
        )

    return {
        "access_token": crear_token_operador(
            operador
        ),
        "token_type": "bearer",
        "operador": operador
    }


def bootstrap_admin(
    db: Session,
    nombre: str,
    telefono: str,
    password: str
):
    admin_existente = (
        db.query(
            Operador
        )
        .filter(
            Operador.rol
            ==
            "admin",
            Operador.password_hash
            .isnot(
                None
            )
        )
        .first()
    )

    if admin_existente:
        raise Exception(
            "Ya existe un admin con contraseña"
        )

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            ==
            telefono
        )
        .first()
    )

    if not operador:
        codigo = generar_codigo_operador(
            nombre
        )
        operador = Operador(
            nombre=nombre,
            telefono=telefono,
            codigo_operador=codigo,
            rol="admin",
            activo=True
        )
        db.add(
            operador
        )
    else:
        operador.nombre = nombre
        operador.rol = "admin"
        operador.activo = True

    operador.password_hash = hash_password(
        password
    )

    db.commit()
    db.refresh(
        operador
    )

    return {
        "access_token": crear_token_operador(
            operador
        ),
        "token_type": "bearer",
        "operador": operador
    }


def get_current_operador(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
    db: Session = Depends(
        get_db
    )
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Token requerido"
        )

    payload = decodificar_token(
        credentials.credentials
    )

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id
            ==
            payload.get(
                "sub"
            ),
            Operador.activo
            ==
            True
        )
        .first()
    )

    if not operador:
        raise HTTPException(
            status_code=401,
            detail="Operador no autorizado"
        )

    return operador


def require_permission(
    permiso: str
):
    def dependency(
        operador: Operador = Depends(
            get_current_operador
        )
    ):
        if permiso not in operador.permisos:
            raise HTTPException(
                status_code=403,
                detail="Permiso insuficiente"
            )

        return operador

    return dependency


def validar_rol_auth(
    rol: str
):
    if rol not in ROLES_OPERADOR:
        raise Exception(
            "Rol de operador invalido"
        )

    return rol
