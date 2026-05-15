from sqlalchemy.orm import Session

from models.configuracion import Configuracion


def obtener_configuracion(
    db: Session,
    clave: str
):
    return (
        db.query(
            Configuracion
        )
        .filter(
            Configuracion.clave
            == clave
        )
        .first()
    )


def obtener_valor_configuracion(
    db: Session,
    clave: str,
    default: str
):
    configuracion = obtener_configuracion(
        db,
        clave
    )

    if not configuracion:
        return default

    return configuracion.valor


def crear_o_actualizar_configuracion(
    db: Session,
    clave: str,
    valor: str
):
    configuracion = obtener_configuracion(
        db,
        clave
    )

    if configuracion:
        configuracion.valor = valor
    else:
        configuracion = Configuracion(
            clave=clave,
            valor=valor
        )

        db.add(
            configuracion
        )

    db.commit()

    db.refresh(
        configuracion
    )

    return configuracion


def render_template(
    db: Session,
    clave: str,
    default: str,
    context: dict
):
    template = obtener_valor_configuracion(
        db,
        clave,
        default
    )

    try:
        return template.format(
            **context
        )
    except (
        KeyError,
        IndexError,
        ValueError
    ):
        return default.format(
            **context
        )
