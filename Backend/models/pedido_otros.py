from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String

from Backend.database import Base


class PedidoOtros(Base):

    __tablename__ = "pedido_otros"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    pedido_id = Column(
        Integer,
        ForeignKey("pedidos.id"),
        nullable=False,
        unique=True
    )

    numero_tarjeta = Column(
        String,
        nullable=True
    )

    telefono_destinatario = Column(
        String,
        nullable=True
    )

    punto_recogida_id = Column(
        Integer,
        ForeignKey("puntos_recogida.id"),
        nullable=True
    )

    documento_identidad_url = Column(
        String,
        nullable=True
    )
