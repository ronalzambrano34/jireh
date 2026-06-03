from pydantic import BaseModel
from pydantic import ConfigDict


class MetodoPagoCuentaBase(BaseModel):

    alias: str
    cuenta: str
    titular: str
    qr_url: str | None = None
    predeterminada: bool = False
    activa: bool = True


class MetodoPagoCuentaCreate(MetodoPagoCuentaBase):

    pass


class MetodoPagoCuentaUpdate(BaseModel):

    alias: str | None = None
    cuenta: str | None = None
    titular: str | None = None
    qr_url: str | None = None
    predeterminada: bool | None = None
    activa: bool | None = None


class MetodoPagoCuentaResponse(MetodoPagoCuentaBase):

    model_config = ConfigDict(from_attributes=True)

    id: int
    metodo_pago_id: int
