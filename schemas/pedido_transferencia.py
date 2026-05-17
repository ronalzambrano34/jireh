from pydantic import AliasChoices
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class PedidoTransferenciaCreate(
    BaseModel
):

    model_config = ConfigDict(
        populate_by_name=True
    )

    monto_pago: float = Field(
        validation_alias=AliasChoices(
            "monto_pago",
            "pix"
        )
    )

    moneda_pago: str = "BRL"

    numero_tarjeta: str

    telefono: str | None = None

    tipo_pago_id: int

    operador_id: int
