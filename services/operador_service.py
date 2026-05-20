from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.operador import (
    Operador
)

from schemas.operador import (
    ROLES_OPERADOR
)

from services.generador_operador import (
    generar_codigo_operador
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
    data
):

    operador = obtener_operador(
        db,
        operador_id
    )

    cambios = data.model_dump(
        exclude_unset=True
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
    operador_id: int
):

    operador = obtener_operador(
        db,
        operador_id
    )

    operador.activo = False

    db.commit()
    db.refresh(
        operador
    )

    return operador
