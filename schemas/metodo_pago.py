from pydantic import BaseModel
from pydantic import ConfigDict


class MetodoPagoBase(
    BaseModel
):

    nombre: str

    moneda: str


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


class MetodoPagoResponse(
    MetodoPagoBase
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    activo: bool
