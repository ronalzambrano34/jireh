from sqlalchemy import Boolean
from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.sql import func
import json

from Backend.database import Base
from Backend.models.operador import PERMISOS_POR_ROL
from Backend.schemas.operador import PERMISOS_OPERADOR


ROLES_OPERADOR_DEFAULT = {
    "consultor": {
        "nombre": "Consultor",
        "descripcion": "Solo lectura",
        "permisos": PERMISOS_POR_ROL["consultor"],
    },
    "operador": {
        "nombre": "Operador",
        "descripcion": "Pedidos y clientes",
        "permisos": PERMISOS_POR_ROL["operador"],
    },
    "admin": {
        "nombre": "Admin",
        "descripcion": "Permisos generales",
        "permisos": PERMISOS_POR_ROL["admin"],
    },
}


class OperadorRol(Base):

    __tablename__ = "operador_roles"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    permisos_config = Column(String, nullable=False, default="[]")
    activo = Column(Boolean, default=True)
    protegido = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    @property
    def permisos(self):
        try:
            permisos = json.loads(self.permisos_config or "[]")
        except (TypeError, ValueError):
            permisos = []

        if not isinstance(permisos, list):
            return []

        return [
            permiso
            for permiso in permisos
            if permiso in PERMISOS_OPERADOR
        ]
