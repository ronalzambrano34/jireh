from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.sql import func

from Backend.database import Base


class ExtraccionCuenta(Base):

    __tablename__ = "extracciones_cuenta"

    id = Column(Integer, primary_key=True, index=True)
    cuenta_pago_id = Column(
        Integer,
        ForeignKey("metodo_pago_cuentas.id"),
        nullable=False,
        index=True
    )
    operador_id = Column(
        Integer,
        ForeignKey("operadores.id"),
        nullable=False,
        index=True
    )
    monto = Column(Float, nullable=False)
    motivo = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)
