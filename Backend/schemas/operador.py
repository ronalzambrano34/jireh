from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


ROLES_OPERADOR = (
    "admin",
    "supervisor",
    "operador"
)

PERMISOS_OPERADOR = (
    "pedidos:crear",
    "pedidos:gestionar",
    "clientes:crear",
    "clientes:gestionar",
    "contactos:gestionar",
    "operadores:ver",
    "operadores:crear",
    "operadores:editar",
    "operadores:desactivar",
    "configuracion:gestionar",
    "empresa:control_total"
)


class OperadorCreate(
    BaseModel
):

    nombre: str

    telefono: str

    password: str

    rol: str = "operador"

    permisos: list[str] | None = None


class OperadorUpdate(
    BaseModel
):

    nombre: str | None = None

    telefono: str | None = None

    password: str | None = None

    rol: str | None = None

    activo: bool | None = None

    permisos: list[str] | None = None


class OperadorResponse(
    BaseModel
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    nombre: str

    codigo_operador: str

    telefono: str | None = None

    foto_url: str | None = None

    rol: str

    activo: bool

    permisos: list[str] = Field(
        default_factory=list
    )
