from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class PaqueteSaldoCreate(BaseModel):

    nombre: str

    monto_pago: Decimal = Field(
        gt=0
    )

    moneda_pago: str = "BRL"

    origen: str = "manual"

    saldo_cup: int = Field(
        gt=0
    )

    activo: bool = True


class PaqueteSaldoUpdate(BaseModel):

    nombre: str | None = None

    monto_pago: Decimal | None = None

    moneda_pago: str | None = None

    origen: str | None = None

    saldo_cup: int | None = None

    activo: bool | None = None


class PaqueteSaldoResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    nombre: str

    monto_pago: Decimal

    moneda_pago: str | None = None

    origen: str | None = None

    saldo_cup: int

    activo: bool
