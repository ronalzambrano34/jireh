from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Float
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy.sql import func

from database import Base


class Pedido(Base):

    __tablename__ = "pedidos"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    codigo_operacion = Column(
        String,
        unique=True,
        nullable=True
    )

    cliente_id = Column(
        Integer,
        ForeignKey("clientes.id"),
        nullable=True
    )

    operador_id = Column(
        Integer,
        ForeignKey("operadores.id"),
        nullable=True
    )

    servicio = Column(
        String,
        nullable=False
    )

    estado = Column(
        String,
        default="pendiente"
    )

    monto_pago = Column(
        Float,
        nullable=False
    )

    moneda_pago = Column(
        String,
        default="BRL",
        nullable=False
    )

    tipo_pago_id = Column(
        Integer,
        ForeignKey("metodos_pago.id")
    )

    oferta_id = Column(
        Integer,
        ForeignKey("ofertas.id"),
        nullable=True
    )

    tasa_usada = Column(
        Float,
        nullable=False
    )

    bonificacion = Column(
        Float,
        default=0
    )

    tasa_final = Column(
        Float,
        nullable=False
    )

    monto_resultado = Column(
        Float,
        nullable=False
    )

    ganancia = Column(
        Float,
        default=0
    )

    comprobante_pago = Column(
        String,
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
