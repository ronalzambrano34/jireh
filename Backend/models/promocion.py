from datetime import datetime

from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text

from Backend.database import Base


class Promocion(Base):

    __tablename__ = "promociones"

    id = Column(Integer, primary_key=True, index=True)

    tipo = Column(String, nullable=False, default="promocion", index=True)

    titulo = Column(String, nullable=False, default="")

    subtitulo = Column(String, nullable=False, default="")

    imagen_url = Column(String, nullable=False, default="")

    descripcion = Column(Text, nullable=False)

    orden = Column(Integer, nullable=False, default=0)

    fecha_desde = Column(DateTime, nullable=False, index=True)

    fecha_hasta = Column(DateTime, nullable=False, index=True)

    activa = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def vigente(self):
        ahora = datetime.utcnow()
        return bool(self.activa and self.fecha_desde <= ahora <= self.fecha_hasta)
