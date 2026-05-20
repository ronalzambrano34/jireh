from sqlalchemy.orm import Session

from Backend.models.configuracion import (
    Configuracion
)


def obtener_config(
    db: Session,
    clave: str,
    default=None
):

    item = (
        db.query(
            Configuracion
        )
        .filter(
            Configuracion.clave
            ==
            clave
        )
        .first()
    )

    if not item:
        return default

    return item.valor