from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String

from Backend.database import Base


class ProvinciaServicio(Base):

    __tablename__ = "provincias_servicio"

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
        default=False
    )
