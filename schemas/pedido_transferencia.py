from pydantic import BaseModel


class PedidoTransferenciaCreate(
    BaseModel
):

    pix: float

    numero_tarjeta: str

    telefono: str | None = None

    tipo_pago_id: int

    operador_codigo: str