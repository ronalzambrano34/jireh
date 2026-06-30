from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class PromocionBase(BaseModel):

    tipo: str = "promocion"

    titulo: str | None = ""

    subtitulo: str | None = ""

    imagen_url: str | None = None

    descripcion: str | None = ""

    orden: int = 0

    fecha_desde: datetime

    fecha_hasta: datetime


class PromocionCreate(PromocionBase):

    activa: bool = True


class PromocionUpdate(BaseModel):

    tipo: str | None = None

    titulo: str | None = None

    subtitulo: str | None = None

    imagen_url: str | None = None

    descripcion: str | None = None

    orden: int | None = None

    fecha_desde: datetime | None = None

    fecha_hasta: datetime | None = None

    activa: bool | None = None


class PromocionResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int

    tipo: str

    titulo: str

    subtitulo: str

    imagen_url: str

    descripcion: str

    orden: int

    fecha_desde: datetime

    fecha_hasta: datetime

    activa: bool

    vigente: bool

    created_at: datetime | None = None

    updated_at: datetime | None = None
