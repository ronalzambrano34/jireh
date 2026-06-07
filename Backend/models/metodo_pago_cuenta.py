from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import relationship

from Backend.database import Base


class MetodoPagoCuenta(Base):

    __tablename__ = "metodo_pago_cuentas"

    id = Column(Integer, primary_key=True, index=True)
    metodo_pago_id = Column(Integer, ForeignKey("metodos_pago.id"), nullable=False, index=True)
    alias = Column(String, nullable=False)
    cuenta = Column(String, nullable=False)
    titular = Column(String, nullable=False)
    qr_url = Column(String, nullable=True)
    predeterminada = Column(Boolean, default=False, index=True)
    activa = Column(Boolean, default=True, index=True)

    metodo_pago = relationship("MetodoPago", back_populates="cuentas")
