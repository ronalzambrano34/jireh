from pydantic import BaseModel


class OperadorCreate(
    BaseModel
):

    nombre: str

    telefono: str