from sqlalchemy.orm import (
    Session
)

from services.config_service import (
    obtener_config
)


def render_template(
    db: Session,
    clave: str,
    variables: dict
):

    template = (
        obtener_config(
            db,
            clave
        )
    )

    if not template:
        raise Exception(
            f"Plantilla {clave} no encontrada"
        )

    for key, value in (
        variables.items()
    ):

        template = (
            template.replace(
                f"{{{key}}}",
                str(value)
            )
        )

    return template