from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class ExtraccionCuentaCreate(BaseModel):

    cuenta_pago_id: int
    monto: float
    motivo: str


class ExtraccionCuentaResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int
    cuenta_pago_id: int
    operador_id: int
    monto: float
    motivo: str
    created_at: datetime
