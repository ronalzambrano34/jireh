from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy.sql import func

from database import Base


class Operador(Base):

    __tablename__ = "operadores"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False
    )

    codigo_operador = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    telefono = Column(
        String,
        unique=True
    )

    password_hash = Column(
        String,
        nullable=True
    )

    rol = Column(
        String,
        nullable=False,
        default="operador"
    )

    activo = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    @property
    def permisos(self):
        permisos_por_rol = {
            "admin": [
                "operadores:ver",
                "operadores:crear",
                "operadores:editar",
                "operadores:desactivar",
                "empresa:control_total",
                "pedidos:gestionar",
                "clientes:gestionar",
                "configuracion:gestionar"
            ],
            "supervisor": [
                "pedidos:gestionar",
                "clientes:gestionar",
                "operadores:ver"
            ],
            "operador": [
                "pedidos:crear",
                "clientes:crear",
                "contactos:gestionar"
            ]
        }

        return permisos_por_rol.get(
            self.rol,
            permisos_por_rol["operador"]
        )

