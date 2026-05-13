from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from datetime import datetime

from database import Base


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True)

    numero = Column(String)

    tipo = Column(String)

    monto = Column(String)

    estado = Column(
        String,
        default="pendiente"
    )

    fecha = Column(
        DateTime,
        default=datetime.utcnow
    )