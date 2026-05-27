from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class PromocionBase(BaseModel):

    imagen_url: str | None = None

    descripcion: str

    fecha_desde: datetime

    fecha_hasta: datetime


class PromocionCreate(PromocionBase):

    activa: bool = True


class PromocionUpdate(BaseModel):

    imagen_url: str | None = None

    descripcion: str | None = None

    fecha_desde: datetime | None = None

    fecha_hasta: datetime | None = None

    activa: bool | None = None


class PromocionResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int

    imagen_url: str

    descripcion: str

    fecha_desde: datetime

    fecha_hasta: datetime

    activa: bool

    vigente: bool

    created_at: datetime | None = None

    updated_at: datetime | None = None
