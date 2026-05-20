from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.sql import func

from Backend.database import Base


class Configuracion(Base):

    __tablename__ = (
        "configuraciones"
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    clave = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    valor = Column(
        Text,
        nullable=False
    )

    editable = Column(
        Boolean,
        default=True
    )

    descripcion = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )