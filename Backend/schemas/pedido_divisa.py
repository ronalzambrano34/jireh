from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoDivisaCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    monto_pago: float

    moneda_pago: str = "BRL"

    tipo_tarjeta: str | None = None

    numero_tarjeta: str | None = None

    telefono_destinatario: str | None = None

    contacto_id: int | None = None

    monto_divisa: float

    tipo_pago_id: int

    cuenta_pago_id: int | None = None

    operador_id: int

    cliente_id: int | None = None

    nombre_cliente: str | None = None

    numero_telefono_cliente: str | None = None

    observaciones: str | None = None
