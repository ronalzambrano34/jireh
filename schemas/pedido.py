from pydantic import BaseModel


class PedidoEstadoUpdate(
    BaseModel
):

    estado: str

    comprobante_pago: str | None = None
