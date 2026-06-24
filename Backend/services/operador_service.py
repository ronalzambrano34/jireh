from sqlalchemy import or_
import json
from sqlalchemy.orm import Session

from Backend.config import OPERADOR_ADMIN_TELEFONO

from Backend.models.operador import (
    Operador,
    PERMISOS_POR_ROL
)

from Backend.schemas.operador import (
    PERMISOS_OPERADOR,
    ROLES_OPERADOR
)

from Backend.services.generador_operador import (
    generar_codigo_operador
)
from Backend.services.auth_service import (
    hash_password
)
from Backend.services.operador_rol_service import asegurar_roles_default
from Backend.services.operador_rol_service import permisos_por_rol
from Backend.services.operador_rol_service import rol_existe


def _validar_rol(
    rol: str | None,
    db: Session | None = None
):

    rol_normalizado = (
        rol
        or "operador"
    ).strip().lower()

    if db is not None:
        if not rol_existe(
            db,
            rol_normalizado
        ):
            raise Exception(
                "Rol de operador invalido"
            )
        return rol_normalizado

    if rol_normalizado not in ROLES_OPERADOR:
        raise Exception(
            "Rol de operador invalido"
        )

    return rol_normalizado




def _validar_permisos(
    permisos: list[str] | None,
    rol: str | None = None
):
    if permisos is None:
        return None

    permisos_validos = set(
        PERMISOS_OPERADOR
    )
    permisos_normalizados = []

    for permiso in permisos:
        permiso_normalizado = (
            permiso
            or ""
        ).strip()

        if permiso_normalizado not in permisos_validos:
            raise Exception(
                f"Permiso de operador invalido: {permiso_normalizado}"
            )

        if permiso_normalizado not in permisos_normalizados:
            permisos_normalizados.append(
                permiso_normalizado
            )

    return json.dumps(
        permisos_normalizados
    )


def _permisos_por_rol(
    rol: str | None,
    db: Session | None = None
):
    rol_normalizado = _validar_rol(
        rol,
        db
    )
    if db is not None:
        return permisos_por_rol(
            db,
            rol_normalizado
        )
    return PERMISOS_POR_ROL.get(
        rol_normalizado,
        PERMISOS_POR_ROL["operador"]
    )

def _normalizar_telefono(
    telefono: str | None
):
    return (
        telefono
        or ""
    ).strip()


def _es_admin_protegido(
    operador: Operador
):
    return (
        operador.rol == "admin"
        and _normalizar_telefono(
            operador.telefono
        ) == _normalizar_telefono(
            OPERADOR_ADMIN_TELEFONO
        )
    )


def _proteger_admin_configurado(
    operador: Operador,
    cambios: dict,
    operador_actual: Operador | None = None
):
    if not _es_admin_protegido(
        operador
    ):
        return

    mismo_operador = (
        operador_actual is not None
        and operador_actual.id == operador.id
    )

    campos_bloqueados = {
        "telefono",
        "rol",
        "activo"
    }

    if campos_bloqueados.intersection(
        cambios.keys()
    ):
        raise Exception(
            "El admin protegido no puede ser desactivado, degradado ni cambiar de telefono desde el panel"
        )

    if "permisos" in cambios and set(
        cambios.get("permisos")
        or []
    ) != set(
        operador.permisos
    ):
        raise Exception(
            "Los permisos del admin protegido no se pueden cambiar desde el panel"
        )

    if not mismo_operador and (
        "password" in cambios
        or "password_hash" in cambios
    ):
        raise Exception(
            "La contraseña del admin protegido solo puede cambiarla ese mismo usuario"
        )


def listar_operadores(
    db: Session,
    busqueda: str | None = None,
    rol: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0
):

    asegurar_roles_default(db)

    query = db.query(
        Operador
    )

    if not incluir_inactivos:
        query = query.filter(
            Operador.activo
            == True
        )

    if rol:
        query = query.filter(
            Operador.rol
            == _validar_rol(
                rol,
                db
            )
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Operador.nombre.ilike(
                    patron
                ),
                Operador.telefono.ilike(
                    patron
                ),
                Operador.codigo_operador.ilike(
                    patron
                )
            )
        )

    limit_seguro = max(
        1,
        min(
            limit,
            200
        )
    )
    offset_seguro = max(
        offset,
        0
    )

    return (
        query
        .order_by(
            Operador.created_at.desc(),
            Operador.id.desc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )


def obtener_operador(
    db: Session,
    operador_id: int
):

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id
            == operador_id
        )
        .first()
    )

    if not operador:
        raise Exception(
            "Operador no encontrado"
        )

    return operador


def crear_operador(
    db: Session,
    data
):

    asegurar_roles_default(db)

    existe = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            == data.telefono
        )
        .first()
    )

    if existe:

        raise Exception(
            "El operador ya existe"
        )

    codigo = None

    while True:

        codigo_temp = (
            generar_codigo_operador(
                data.nombre
            )
        )

        existe_codigo = (
            db.query(
                Operador
            )
            .filter(
                Operador.codigo_operador
                == codigo_temp
            )
            .first()
        )

        if not existe_codigo:

            codigo = (
                codigo_temp
            )

            break

    operador = Operador(

        nombre=data.nombre,

        telefono=data.telefono,

        rol=_validar_rol(
            data.rol,
            db
        ),

        password_hash=(
            hash_password(
                data.password
            )
            if data.password
            else None
        ),

        permisos_config=_validar_permisos(
            data.permisos
            if data.permisos is not None
            else _permisos_por_rol(
                data.rol,
                db
            )
        ),

        codigo_operador=codigo
    )

    db.add(
        operador
    )

    db.commit()

    db.refresh(
        operador
    )

    return operador


def actualizar_operador(
    db: Session,
    operador_id: int,
    data,
    operador_actual: Operador | None = None
):

    asegurar_roles_default(db)

    operador = obtener_operador(
        db,
        operador_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    _proteger_admin_configurado(
        operador,
        cambios,
        operador_actual
    )

    if "telefono" in cambios and cambios["telefono"]:
        existe = (
            db.query(
                Operador
            )
            .filter(
                Operador.telefono
                == cambios["telefono"],
                Operador.id
                != operador.id
            )
            .first()
        )

        if existe:
            raise Exception(
                "El operador ya existe"
            )

    if "rol" in cambios:
        cambios["rol"] = _validar_rol(
            cambios["rol"],
            db
        )

    if "permisos" in cambios:
        permisos = cambios.pop(
            "permisos"
        )
        cambios["permisos_config"] = _validar_permisos(
            permisos
        )

    if "password" in cambios:
        password = cambios.pop(
            "password"
        )
        if password:
            cambios["password_hash"] = hash_password(
                password
            )

    for campo, valor in cambios.items():
        setattr(
            operador,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        operador
    )

    return operador


def eliminar_operador(
    db: Session,
    operador_id: int,
    operador_actual: Operador | None = None
):

    operador = obtener_operador(
        db,
        operador_id
    )

    _proteger_admin_configurado(
        operador,
        {
            "activo": False
        },
        operador_actual
    )

    operador.activo = False

    db.commit()
    db.refresh(
        operador
    )

    return operador
