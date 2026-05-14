from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy.sql import func

from database import Base


class Oferta(Base):

    __tablename__ = "ofertas"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    servicio = Column(
        String,
        nullable=False
    )

    nombre = Column(
        String
    )

    tasa = Column(
        Float,
        nullable=False
    )

    minimo_brl = Column(
        Float,
        default=0
    )

    activa = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )