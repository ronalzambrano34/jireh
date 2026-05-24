from sqlalchemy.orm import (
    Session
)

from Backend.services.config_service import (
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

        # Reemplazar {{key}} (double braces)
        template = (
            template.replace(
                f"{{{{{key}}}}}",
                str(value or "")
            )
        )

        # Reemplazar {key} (single braces)
        template = (
            template.replace(
                f"{{{key}}}",
                str(value or "")
            )
        )

    return template


def render_text_template(
    template: str,
    variables: dict
):

    for key, value in (
        variables.items()
    ):

        # Reemplazar {{key}} (double braces)
        template = (
            template.replace(
                f"{{{{{key}}}}}",
                str(value or "")
            )
        )

        # Reemplazar {key} (single braces)
        template = (
            template.replace(
                f"{{{key}}}",
                str(value or "")
            )
        )

    return template

from sqlalchemy.orm import (
    Session
)

from Backend.models.configuracion import (
    Configuracion
)


def listar_templates(
    db: Session
):

    templates = (
        db.query(
            Configuracion
        )
        .filter(
            Configuracion.clave.like(
                "template_%"
            )
        )
        .all()
    )

    return [

        {
            "clave":
            item.clave,

            "valor":
            item.valor
        }

        for item in templates
    ]


def obtener_template(
    db: Session,
    clave: str
):

    template = (
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

    if not template:

        raise Exception(
            "Template no encontrado"
        )

    return {

        "clave":
        template.clave,

        "valor":
        template.valor
    }


def actualizar_template(
    db: Session,
    clave: str,
    valor: str
):

    template = (
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

    if not template:

        template = Configuracion(
            clave=clave,
            valor=valor
        )

        db.add(
            template
        )

    else:

        template.valor = (
            valor
        )

    db.commit()

    db.refresh(
        template
    )

    return {

        "message":
        "Template actualizado",

        "clave":
        template.clave
    }