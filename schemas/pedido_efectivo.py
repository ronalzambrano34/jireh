from pydantic import AliasChoices
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class PedidoEfectivoCreate(
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

    tipo_pago_id: int

    operador_codigo: str

    punto_recogida_id: int
