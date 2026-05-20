from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class ConfiguracionBase(
    BaseModel
):

    clave: str

    valor: str


class ConfiguracionCreate(
    ConfiguracionBase
):

    pass


class ConfiguracionUpdate(
    BaseModel
):

    valor: str


class ConfiguracionResponse(
    ConfiguracionBase
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    editable: bool = True

    descripcion: str | None = None

    created_at: datetime | None = None

    updated_at: datetime | None = None
