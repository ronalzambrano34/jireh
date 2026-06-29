from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoEfectivoCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    monto_pago: float

    idempotency_key: str | None = None

    moneda_pago: str = "BRL"

    tipo_pago_id: int

    cuenta_pago_id: int | None = None

    operador_id: int

    cliente_id: int | None = None

    nombre_cliente: str | None = None

    numero_telefono_cliente: str | None = None

    telefono_destinatario: str | None = None

    documento_identidad_url: str | None = None

    contacto_id: int | None = None

    punto_recogida_id: int | None = None

    bonificacion_manual: float | None = 0

    observaciones: str | None = None
