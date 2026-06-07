from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy import ForeignKey

from sqlalchemy.orm import relationship

from Backend.database import Base


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

    provincia_id = Column(
        Integer,
        ForeignKey("provincias_servicio.id"),
        nullable=True
    )

    provincia = relationship(
        "ProvinciaServicio"
    )

    activo = Column(
        Boolean,
        default=True
    )

    @property
    def provincia_nombre(self):
        return self.provincia.nombre if self.provincia else None
