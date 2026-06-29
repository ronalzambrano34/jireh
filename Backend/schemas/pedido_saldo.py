from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoSaldoCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    telefono_destinatario: str | None = None

    idempotency_key: str | None = None

    contacto_id: int | None = None

    tipo_pago_id: int

    cuenta_pago_id: int | None = None

    operador_id: int

    cliente_id: int | None = None

    nombre_cliente: str | None = None

    numero_telefono_cliente: str | None = None

    paquete_saldo_id: int | None = None

    monto_pago: float | None = None

    saldo_cup: float | None = None

    moneda_pago: str = "BRL"

    bonificacion_manual: float | None = 0

    observaciones: str | None = None
