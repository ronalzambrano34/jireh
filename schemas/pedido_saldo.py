from pydantic import AliasChoices
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class PedidoSaldoCreate(
    BaseModel
):

    model_config = ConfigDict(
        populate_by_name=True
    )

    numero_telefono: str

    tipo_pago_id: int

    operador_id: int

    cliente_id: int | None = None

    numero_telefono_cliente: str | None = None

    paquete_saldo_id: int | None = None

    monto_pago: float | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "monto_pago",
            "pix"
        )
    )

    saldo_cup: float | None = None

    moneda_pago: str = "BRL"
