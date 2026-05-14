from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import DateTime
from sqlalchemy.sql import func

from database import Base


class Cliente(Base):

    __tablename__ = "clientes"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=True
    )

    telefono = Column(
        String,
        unique=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )