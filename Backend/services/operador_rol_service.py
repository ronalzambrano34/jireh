import json
import re

from sqlalchemy.orm import Session

from Backend.models.operador import Operador
from Backend.models.operador_rol import OperadorRol
from Backend.models.operador_rol import ROLES_OPERADOR_DEFAULT
from Backend.schemas.operador import PERMISOS_OPERADOR


def _normalizar_clave(value: str | None, fallback: str = ""):
    base = (value or fallback or "").strip().lower()
    clave = re.sub(r"[^a-z0-9_]+", "_", base).strip("_")
    if not clave:
        raise Exception("La clave del rol es obligatoria")
    return clave


def _validar_permisos(permisos: list[str] | None):
    permisos_validos = set(PERMISOS_OPERADOR)
    resultado = []

    for permiso in permisos or []:
        permiso_normalizado = (permiso or "").strip()
        if permiso_normalizado not in permisos_validos:
            raise Exception(f"Permiso invalido: {permiso_normalizado}")
        if permiso_normalizado not in resultado:
            resultado.append(permiso_normalizado)

    return resultado


def _permisos_json(permisos: list[str] | None):
    return json.dumps(_validar_permisos(permisos))


def asegurar_roles_default(db: Session):
    for clave, data in ROLES_OPERADOR_DEFAULT.items():
        rol = db.query(OperadorRol).filter(OperadorRol.clave == clave).first()
        if rol:
            if not rol.nombre:
                rol.nombre = data["nombre"]
            if rol.permisos_config in (None, "", "[]"):
                rol.permisos_config = _permisos_json(data["permisos"])
            rol.protegido = True
            continue

        db.add(OperadorRol(
            clave=clave,
            nombre=data["nombre"],
            descripcion=data["descripcion"],
            permisos_config=_permisos_json(data["permisos"]),
            activo=True,
            protegido=True
        ))

    db.commit()


def listar_roles(db: Session, incluir_inactivos: bool = False):
    asegurar_roles_default(db)
    query = db.query(OperadorRol)
    if not incluir_inactivos:
        query = query.filter(OperadorRol.activo == True)
    return query.order_by(OperadorRol.protegido.desc(), OperadorRol.nombre.asc()).all()


def obtener_rol(db: Session, rol_id: int):
    asegurar_roles_default(db)
    rol = db.query(OperadorRol).filter(OperadorRol.id == rol_id).first()
    if not rol:
        raise Exception("Rol no encontrado")
    return rol


def obtener_rol_por_clave(db: Session, clave: str):
    asegurar_roles_default(db)
    return db.query(OperadorRol).filter(OperadorRol.clave == _normalizar_clave(clave)).first()


def permisos_por_rol(db: Session, clave: str):
    rol = obtener_rol_por_clave(db, clave)
    if not rol or not rol.activo:
        raise Exception("Rol de operador invalido")
    return rol.permisos


def rol_existe(db: Session, clave: str):
    rol = obtener_rol_por_clave(db, clave)
    return bool(rol and rol.activo)


def crear_rol(db: Session, data):
    asegurar_roles_default(db)
    clave = _normalizar_clave(data.clave, data.nombre)

    if db.query(OperadorRol).filter(OperadorRol.clave == clave).first():
        raise Exception("El rol ya existe")

    rol = OperadorRol(
        clave=clave,
        nombre=data.nombre.strip(),
        descripcion=(data.descripcion or "").strip() or None,
        permisos_config=_permisos_json(data.permisos),
        activo=data.activo,
        protegido=False
    )
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


def actualizar_rol(db: Session, rol_id: int, data):
    rol = obtener_rol(db, rol_id)
    cambios = data.model_dump(exclude_unset=True)

    if "nombre" in cambios and cambios["nombre"] is not None:
        rol.nombre = cambios["nombre"].strip()
    if "descripcion" in cambios:
        rol.descripcion = (cambios["descripcion"] or "").strip() or None
    if "permisos" in cambios:
        rol.permisos_config = _permisos_json(cambios["permisos"])
        db.query(Operador).filter(Operador.rol == rol.clave).update({
            Operador.permisos_config: rol.permisos_config
        }, synchronize_session=False)
    if "activo" in cambios:
        if rol.protegido and cambios["activo"] is False:
            raise Exception("Los roles base no se pueden desactivar")
        rol.activo = cambios["activo"]

    db.commit()
    db.refresh(rol)
    return rol


def eliminar_rol(db: Session, rol_id: int):
    rol = obtener_rol(db, rol_id)
    if rol.protegido:
        raise Exception("Los roles base no se pueden eliminar")

    operadores = db.query(Operador).filter(Operador.rol == rol.clave).count()
    if operadores:
        raise Exception("No se puede eliminar un rol con operadores asignados")

    db.delete(rol)
    db.commit()
    return rol
