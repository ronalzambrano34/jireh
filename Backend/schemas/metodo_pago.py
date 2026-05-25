from pydantic import BaseModel
from pydantic import ConfigDict


class MetodoPagoBase(
    BaseModel
):

    nombre: str

    moneda: str

    imagen_url: str | None = None


class MetodoPagoCreate(
    MetodoPagoBase
):

    pass


class MetodoPagoUpdate(
    BaseModel
):

    nombre: str | None = None

    moneda: str | None = None

    activo: bool | None = None

    imagen_url: str | None = None


class MetodoPagoResponse(
    MetodoPagoBase
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    activo: bool
