import json

from sqlalchemy.orm import Session

from Backend.models.configuracion import Configuracion

PHONE_CODES_CONFIG_KEY = "codigos_pais_telefono_activos"
DEFAULT_ACTIVE_PHONE_CODES = ["+53", "+55", "+598"]
DEFAULT_ACTIVE_PHONE_CODES_VALUE = json.dumps(DEFAULT_ACTIVE_PHONE_CODES)

CONFIGURACIONES_DEFAULT = {
    "whatsapp_grupo_pedidos_url": "",
    "whatsapp_grupo_finalizados_url": "",
    PHONE_CODES_CONFIG_KEY: DEFAULT_ACTIVE_PHONE_CODES_VALUE,
}

CONFIGURACIONES_DESCRIPCION = {
    "whatsapp_grupo_pedidos_url": "Link de WhatsApp del grupo donde se trabajan los pedidos nuevos.",
    "whatsapp_grupo_finalizados_url": "Link de WhatsApp del grupo historico de operaciones finalizadas.",
    PHONE_CODES_CONFIG_KEY: "Codigos de pais visibles en formularios de telefono.",
}


def asegurar_configuraciones_default(db: Session):
    for clave, valor in CONFIGURACIONES_DEFAULT.items():
        existe = db.query(Configuracion).filter(Configuracion.clave == clave).first()
        if existe:
            if not existe.descripcion:
                existe.descripcion = CONFIGURACIONES_DESCRIPCION.get(clave)
            continue

        db.add(Configuracion(
            clave=clave,
            valor=valor,
            descripcion=CONFIGURACIONES_DESCRIPCION.get(clave),
        ))

    db.flush()


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


def listar_configuraciones(
    db: Session
):
    asegurar_configuraciones_default(db)
    db.commit()
    return (
        db.query(
            Configuracion
        )
        .order_by(
            Configuracion.clave.asc()
        )
        .all()
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
