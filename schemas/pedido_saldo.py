from pydantic import BaseModel
from pydantic import ConfigDict


class PedidoSaldoCreate(
    BaseModel
):

    model_config = ConfigDict(
        extra="forbid"
    )

    telefono_destinatario: str

    tipo_pago_id: int

    operador_id: int

    cliente_id: int | None = None

    numero_telefono_cliente: str | None = None

    paquete_saldo_id: int | None = None

    monto_pago: float | None = None

    saldo_cup: float | None = None

    moneda_pago: str = "BRL"
