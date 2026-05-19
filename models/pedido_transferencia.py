from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from database import Base


class PedidoTransferencia(Base):

    __tablename__ = "pedido_transferencia"

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

    numero_tarjeta = Column(
        String,
        nullable=False
    )

    telefono_destinatario = Column(
        String,
        nullable=True
    )

    monto_cup = Column(
        Float,
        nullable=False
    )