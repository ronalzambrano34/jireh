from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


TIPOS_ARCHIVO_PEDIDO = {
    "comprobante_cliente",
    "captura_operador",
    "comprobante_final",
    "documento_identidad",
    "otro",
}


class ArchivoPedidoCreate(BaseModel):

    model_config = ConfigDict(
        extra="forbid"
    )

    tipo: str

    ruta_archivo: str

    nombre_archivo: str | None = None

    mime_type: str | None = None

    notas: str | None = None

    usuario: str | None = None


class ArchivoPedidoResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    pedido_id: int

    tipo: str

    ruta_archivo: str

    nombre_archivo: str | None = None

    mime_type: str | None = None

    notas: str | None = None

    usuario: str | None = None

    created_at: datetime | None = None
