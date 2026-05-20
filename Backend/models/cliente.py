from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy.sql import func

from Backend.database import Base


class Cliente(Base):

    __tablename__ = "clientes"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        nullable=True,
        index=True
    )

    telefono = Column(
        String,
        nullable=True
    )

    google_id = Column(
        String,
        unique=True,
        nullable=True
    )

    pais = Column(
        String,
        nullable=True
    )

    moneda_preferida = Column(
        String,
        default="BRL"
    )

    referido_por_id = Column(
        Integer,
        ForeignKey("clientes.id"),
        nullable=True
    )

    codigo_referido = Column(
        String,
        unique=True,
        nullable=True
    )

    perfil_completo = Column(
        Boolean,
        default=False
    )

    activo = Column(
        Boolean,
        default=True
    )

    es_admin = Column(
        Boolean,
        default=False
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