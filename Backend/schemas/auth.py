from pydantic import BaseModel
from pydantic import ConfigDict

from Backend.schemas.operador import OperadorResponse


class LoginRequest(BaseModel):

    telefono: str

    password: str


class BootstrapAdminRequest(BaseModel):

    nombre: str

    telefono: str

    password: str


class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "bearer"

    operador: OperadorResponse


class AuthOperadorResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    operador: OperadorResponse


class PerfilUpdateRequest(BaseModel):

    nombre: str


class PasswordChangeRequest(BaseModel):

    password_actual: str

    password_nueva: str
