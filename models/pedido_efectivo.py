from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import ForeignKey

from database import Base


class PedidoEfectivo(Base):

    __tablename__ = "pedido_efectivo"

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

    monto_cup = Column(
        Float,
        nullable=False
    )

    punto_recogida_id = Column(
        Integer,
        ForeignKey(
            "puntos_recogida.id"
        ),
        nullable=False
    )