from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoTransferenciaCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    monto_pago: float

    moneda_pago: str = "BRL"

    numero_tarjeta: str

    telefono_destinatario: str | None = None

    tipo_pago_id: int

    operador_id: int

    cliente_id: int | None = None

    nombre_cliente: str | None = None

    numero_telefono_cliente: str | None = None
