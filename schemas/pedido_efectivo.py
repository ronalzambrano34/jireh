from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoEfectivoCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    monto_pago: float

    moneda_pago: str = "BRL"

    tipo_pago_id: int

    operador_id: int

    cliente_id: int | None = None

    nombre_cliente: str | None = None

    numero_telefono_cliente: str | None = None

    telefono_destinatario: str

    documento_identidad_url: str

    punto_recogida_id: int | None = None

    observaciones: str | None = None
