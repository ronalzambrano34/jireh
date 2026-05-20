from pydantic import BaseModel
from pydantic import ConfigDict


class PuntoRecogidaBase(
    BaseModel
):

    nombre: str

    direccion: str

    telefono: str | None = None


class PuntoRecogidaCreate(
    PuntoRecogidaBase
):

    pass


class PuntoRecogidaUpdate(
    BaseModel
):

    nombre: str | None = None

    direccion: str | None = None

    telefono: str | None = None

    activo: bool | None = None


class PuntoRecogidaResponse(
    PuntoRecogidaBase
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    activo: bool
