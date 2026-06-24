from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy.sql import func
import json

from Backend.database import Base


PERMISOS_POR_ROL = {
    "consultor": [
        "pedidos:ver",
        "clientes:ver",
        "contactos:ver"
    ],
    "operador": [
        "pedidos:ver",
        "pedidos:crear",
        "pedidos:gestionar",
        "clientes:ver",
        "clientes:crear",
        "clientes:gestionar",
        "contactos:ver",
        "contactos:gestionar"
    ],
    "admin": [
        "pedidos:ver",
        "clientes:ver",
        "contactos:ver",
        "operadores:ver",
        "operadores:crear",
        "operadores:editar",
        "operadores:desactivar",
        "reportes:ver",
        "empresa:control_total",
        "pedidos:gestionar",
        "clientes:gestionar",
        "configuracion:gestionar"
    ]
}

PERMISOS_DISPONIBLES = tuple(dict.fromkeys(
    permiso
    for permisos in PERMISOS_POR_ROL.values()
    for permiso in permisos
))


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

    foto_url = Column(
        String,
        nullable=True
    )

    permisos_config = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    @property
    def permisos(self):
        if self.permisos_config:
            try:
                permisos = json.loads(
                    self.permisos_config
                )
            except (TypeError, ValueError):
                permisos = None

            if isinstance(
                permisos,
                list
            ):
                return [
                    permiso
                    for permiso in permisos
                    if permiso in PERMISOS_DISPONIBLES
                ]

        return PERMISOS_POR_ROL.get(
            self.rol,
            PERMISOS_POR_ROL["operador"]
        )
