from sqlalchemy import or_
from sqlalchemy.orm import Session

from Backend.config import OPERADOR_ADMIN_TELEFONO

from Backend.models.operador import (
    Operador
)

from Backend.schemas.operador import (
    ROLES_OPERADOR
)

from Backend.services.generador_operador import (
    generar_codigo_operador
)
from Backend.services.auth_service import (
    hash_password
)


def _validar_rol(
    rol: str | None
):

    rol_normalizado = (
        rol
        or "operador"
    ).strip().lower()

    if rol_normalizado not in ROLES_OPERADOR:
        raise Exception(
            "Rol de operador invalido"
        )

    return rol_normalizado


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
                rol
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
            data.rol
        ),

        password_hash=(
            hash_password(
                data.password
            )
            if data.password
            else None
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
            cambios["rol"]
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
