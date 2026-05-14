from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from database import Base


class PedidoSaldo(Base):

    __tablename__ = "pedido_saldo"

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

    numero_telefono = Column(
        String,
        nullable=False
    )

    saldo_cup = Column(
        Float,
        nullable=False
    )