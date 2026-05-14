from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean

from database import Base


class PuntoRecogida(Base):

    __tablename__ = "puntos_recogida"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False
    )

    direccion = Column(
        String,
        nullable=False
    )

    telefono = Column(
        String
    )

    activo = Column(
        Boolean,
        default=True
    )