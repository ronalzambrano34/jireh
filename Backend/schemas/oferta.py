from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class OfertaCreate(BaseModel):

    servicio: str = Field(
        min_length=1
    )

    nombre: str | None = None

    tasa: float = Field(
        gt=0
    )

    minimo_pago: float = Field(
        default=0,
        ge=0
    )

    moneda_pago: str = "BRL"

    origen: str = "manual"

    activa: bool = True


class OfertaUpdate(BaseModel):

    servicio: str | None = None

    nombre: str | None = None

    tasa: float | None = None

    minimo_pago: float | None = None

    moneda_pago: str | None = None

    origen: str | None = None

    activa: bool | None = None


class OfertaResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    servicio: str

    nombre: str | None = None

    tasa: float

    minimo_pago: float | None = None

    moneda_pago: str | None = None

    origen: str | None = None

    activa: bool
