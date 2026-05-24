from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class ClienteBase(
    BaseModel
):

    nombre: str

    email: str | None = None

    telefono: str | None = None

    pais: str | None = None

    moneda_preferida: str = "BRL"


class ClienteCreate(
    ClienteBase
):

    referido_por_id: int | None = None


class ClienteUpdate(
    BaseModel
):

    nombre: str | None = None

    email: str | None = None

    telefono: str | None = None

    pais: str | None = None

    moneda_preferida: str | None = None

    referido_por_id: int | None = None

    perfil_completo: bool | None = None

    activo: bool | None = None


class ClienteResponse(
    BaseModel
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    nombre: str

    email: str | None = None

    telefono: str | None = None

    google_id: str | None = None

    pais: str | None = None

    moneda_preferida: str | None = None

    referido_por_id: int | None = None

    codigo_referido: str | None = None

    perfil_completo: bool

    activo: bool


    created_at: datetime | None = None

    updated_at: datetime | None = None
