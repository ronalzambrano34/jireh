from pydantic import BaseModel


class OperadorCreate(
    BaseModel
):

    nombre: str

    telefono: str


class OperadorResponse(
    BaseModel
):

    id: int

    nombre: str

    codigo_operador: str

    telefono: str | None = None

    activo: bool

    class Config:
        from_attributes = True