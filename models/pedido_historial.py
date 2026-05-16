from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import (
    relationship
)

from sqlalchemy.sql import (
    func
)

from database import Base


class PedidoHistorial(Base):

    __tablename__ = (
        "pedido_historial"
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    pedido_id = Column(
        Integer,
        ForeignKey(
            "pedidos.id"
        ),
        nullable=False
    )

    estado_anterior = Column(
        String,
        nullable=True
    )

    estado_nuevo = Column(
        String,
        nullable=False
    )

    comentario = Column(
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

    pedido = relationship(
        "Pedido",
        back_populates="historial"
    )