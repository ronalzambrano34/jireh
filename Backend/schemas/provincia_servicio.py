from pydantic import BaseModel
from pydantic import ConfigDict


class ProvinciaServicioCreate(BaseModel):

    nombre: str

    activo: bool = False


class ProvinciaServicioUpdate(BaseModel):

    nombre: str | None = None

    activo: bool | None = None


class ProvinciaServicioResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    nombre: str

    activo: bool
