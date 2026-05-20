from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class Contacto(Base):

    __tablename__ = "contactos"
    __table_args__ = (
        UniqueConstraint(
            "cliente_id",
            "telefono",
            name="uq_contactos_cliente_telefono"
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    cliente_id = Column(
        Integer,
        ForeignKey("clientes.id"),
        nullable=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False
    )

    telefono = Column(
        String,
        nullable=False,
        index=True
    )

    pais = Column(
        String,
        nullable=True
    )

    notas = Column(
        String,
        nullable=True
    )

    activo = Column(
        Boolean,
        default=True
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
