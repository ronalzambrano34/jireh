from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from Backend.database import Base


class PedidoDivisa(Base):

    __tablename__ = "pedido_divisa"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    pedido_id = Column(
        Integer,
        ForeignKey("pedidos.id"),
        nullable=False
    )

    tipo_tarjeta = Column(
        String,
        nullable=False
    )

    numero_tarjeta = Column(
        String,
        nullable=False
    )

    telefono_destinatario = Column(
        String,
        nullable=True
    )

    monto_divisa = Column(
        Float,
        nullable=False
    )