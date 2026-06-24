from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field


class OperadorRolCreate(BaseModel):
    clave: str | None = None
    nombre: str
    descripcion: str | None = None
    permisos: list[str] = Field(default_factory=list)
    activo: bool = True


class OperadorRolUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    permisos: list[str] | None = None
    activo: bool | None = None


class OperadorRolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clave: str
    nombre: str
    descripcion: str | None = None
    permisos: list[str] = Field(default_factory=list)
    activo: bool
    protegido: bool
