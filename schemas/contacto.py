from pydantic import BaseModel
from pydantic import ConfigDict


class ContactoBase(
    BaseModel
):

    nombre: str

    telefono: str | None = None

    numero_tarjeta: str | None = None

    tipo_tarjeta: str | None = None

    documento_identidad_url: str | None = None

    pais: str | None = "br"

    notas: str | None = None


class ContactoCreate(
    ContactoBase
):

    cliente_id: int | None = None


class ContactoUpdate(
    BaseModel
):

    nombre: str | None = None

    telefono: str | None = None

    numero_tarjeta: str | None = None

    tipo_tarjeta: str | None = None

    documento_identidad_url: str | None = None

    pais: str | None = None

    notas: str | None = None

    activo: bool | None = None


class ContactoResponse(
    BaseModel
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    cliente_id: int | None = None

    nombre: str

    telefono: str | None = None

    numero_tarjeta: str | None = None

    tipo_tarjeta: str | None = None

    documento_identidad_url: str | None = None

    pais: str | None = None

    notas: str | None = None

    activo: bool
