from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.sql import func

from Backend.database import Base


class ArchivoPedido(Base):

    __tablename__ = "archivos_pedido"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    pedido_id = Column(
        Integer,
        ForeignKey("pedidos.id"),
        nullable=False,
        index=True
    )

    tipo = Column(
        String,
        nullable=False,
        index=True
    )

    ruta_archivo = Column(
        String,
        nullable=False
    )

    nombre_archivo = Column(
        String,
        nullable=True
    )

    mime_type = Column(
        String,
        nullable=True
    )

    notas = Column(
        String,
        nullable=True
    )

    usuario = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )
