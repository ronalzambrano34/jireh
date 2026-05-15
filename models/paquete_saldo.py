from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy import Numeric
from sqlalchemy import DateTime
from sqlalchemy.sql import func

from database import Base


class PaqueteSaldo(Base):

    __tablename__ = (
        "paquetes_saldo"
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False
    )

    monto_pago = Column(
        Numeric(10, 2),
        nullable=False
    )
    
    moneda_pago = Column(
        String,
        default="BRL"
    )

    saldo_cup = Column(
        Integer,
        nullable=False
    )

    activo = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )
