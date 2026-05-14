from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean

from database import Base


class MetodoPago(Base):

    __tablename__ = "metodos_pago"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        unique=True,
        nullable=False
    )

    activo = Column(
        Boolean,
        default=True
    )