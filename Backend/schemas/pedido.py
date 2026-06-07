from pydantic import BaseModel


class PedidoEstadoUpdate(
    BaseModel
):

    estado: str

    comprobante_pago: str | None = None

    observaciones: str | None = None

    finalizar_sin_comprobante: bool = False

    motivo_sin_comprobante: str | None = None


class PedidoRedireccionUpdate(
    BaseModel
):

    operador_destino_id: int | None = None

    mensaje: str | None = None
