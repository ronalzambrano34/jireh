from pydantic import BaseModel


class PedidoEfectivoCreate(
    BaseModel
):

    pix: float

    tipo_pago_id: int

    operador_codigo: str

    punto_recogida_id: int