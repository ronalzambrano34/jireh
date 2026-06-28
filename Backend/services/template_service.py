import re

from sqlalchemy.orm import (
    Session
)
from decimal import Decimal

from Backend.services.config_service import (
    obtener_config
)


def formatear_valor_template(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float, Decimal)):
        texto = format(Decimal(str(value)), "f")
        if "." in texto:
            texto = texto.rstrip("0").rstrip(".")
        return texto or "0"
    return str(value)


def limpiar_placeholders_vacios(template: str):
    return re.sub(
        r"\{\{?\s*[A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+\s*\}?\}",
        "",
        template
    )


def limpiar_lineas_cuenta_vacia(template: str, variables: dict):
    if formatear_valor_template(variables.get("cuenta_pago")).strip():
        return template

    return re.sub(
        r"(^|\n)[^\n]*(\{\{?\s*cuenta_pago\s*\}?\})[^\n]*(?=\n|$)",
        "",
        template
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

    template = limpiar_lineas_cuenta_vacia(
        template,
        variables
    )

    for key, value in (
        variables.items()
    ):

        # Reemplazar {{key}} (double braces)
        template = (
            template.replace(
                f"{{{{{key}}}}}",
                formatear_valor_template(value)
            )
        )

        # Reemplazar {key} (single braces)
        template = (
            template.replace(
                f"{{{key}}}",
                formatear_valor_template(value)
            )
        )

    return limpiar_placeholders_vacios(template)


def render_text_template(
    template: str,
    variables: dict
):

    template = limpiar_lineas_cuenta_vacia(
        template,
        variables
    )

    for key, value in (
        variables.items()
    ):

        # Reemplazar {{key}} (double braces)
        template = (
            template.replace(
                f"{{{{{key}}}}}",
                formatear_valor_template(value)
            )
        )

        # Reemplazar {key} (single braces)
        template = (
            template.replace(
                f"{{{key}}}",
                formatear_valor_template(value)
            )
        )

    return limpiar_placeholders_vacios(template)

from sqlalchemy.orm import (
    Session
)

from Backend.models.configuracion import (
    Configuracion
)

DEFAULT_FINALIZACION_SIN_COMPROBANTE = (
    "Listo, operacion exitosa para el pedido {codigo_operacion}, "
    "pero por factores ajenos a nosotros no es posible enviar el comprobante."
)

LEGACY_NOTIFICATION_TEMPLATES = {
    "template_grupo_finalizado": (
        "*Operacion finalizada*\nCodigo: {codigo_operacion}\nServicio: {servicio}\nCliente: {cliente_nombre} ({cliente_telefono})\nPago: {monto_pago} {moneda_pago} por {metodo_pago}\nRecibe: {monto_resultado}\nTasa: {tasa_final}\nGanancia: {ganancia}\nComprobante: {comprobante_pago}",
        "*Operacion finalizada*\nCodigo: {codigo_operacion}\nOperador: {operador}\nServicio: {servicio}\nCliente: {cliente_nombre} ({cliente_telefono})\nPago: {monto_pago} {moneda_pago} por {metodo_pago}\nRecibe: {monto_resultado}\nTasa: {tasa_final}\nGanancia: {ganancia}\nComprobante: {comprobante_pago}",
    ),
}

LEGACY_OPERATION_TEMPLATES = {
    "template_transferencia": (
        "*Transferencia*\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
        "*Transferencia*\n*Operador:* {operador}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
    ),
    "template_efectivo": (
        "*Efectivo*\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
        "*Efectivo*\n*Operador:* {operador}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
    ),
    "template_saldo": (
        "*Saldo Movil*\n*Telefono destinatario:* {telefono_destinatario}\n*Saldo:* {saldo_cup} CUP\n*Pago:* {monto_pago} {moneda_pago}",
        "*Saldo Movil*\n*Operador:* {operador}\n*Telefono destinatario:* {telefono_destinatario}\n*Saldo:* {saldo_cup} CUP\n*Pago:* {monto_pago} {moneda_pago}",
        "*Saldo Movil*\n*Operador:* {operador}\n*Telefono destinatario:* {telefono_destinatario}\n*Saldo:* {saldo_cup} CUP\n*Pago:* {monto_pago} {moneda_pago}\n*Cuenta de pago:* {cuenta_pago}",
    ),
    "template_divisa": (
        "*Divisa*\n*Tipo de tarjeta:* {tipo_tarjeta}\n*Numero de tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto divisa:* {monto_divisa}\n*Pago:* {monto_pago} {moneda_pago}\n*Tasa efectiva:* {tasa_final}",
        "*Divisa*\n*Operador:* {operador}\n*Tipo de tarjeta:* {tipo_tarjeta}\n*Numero de tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto divisa:* {monto_divisa}\n*Pago:* {monto_pago} {moneda_pago}\n*Tasa efectiva:* {tasa_final}",
        "*Divisa*\n*Operador:* {operador}\n*Tipo de tarjeta:* {tipo_tarjeta}\n*Numero de tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto divisa:* {monto_divisa}\n*Pago:* {monto_pago} {moneda_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Tasa efectiva:* {tasa_final}",
    ),
    "template_otros": (
        "*Otros*\n*Cliente:* {cliente_nombre}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Punto de recogida:* {punto_recogida_id}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Info:* {observaciones}",
        "*Otros*\n*Operador:* {operador}\n*Cliente:* {cliente_nombre}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Punto de recogida:* {punto_recogida_id}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Info:* {observaciones}",
        "*Otros*\n*Operador:* {operador}\n*Cliente:* {cliente_nombre}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Punto de recogida:* {punto_recogida_id}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Info:* {observaciones}",
        "*Otros*\n*Operador:* {operador}\n*Cliente:* {cliente_nombre}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Punto de recogida:* {punto_recogida}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Descripcion:* {descripcion}",
    ),
}

DEFAULT_NOTIFICATION_TEMPLATES = {
    "template_cliente_estado_pendiente_pago": "Hola {cliente_nombre}, tu pedido {codigo_operacion} esta pendiente de pago. Monto a pagar: {monto_pago} {moneda_pago}.",
    "template_cliente_estado_pago_confirmado": "Hola {cliente_nombre}, confirmamos el pago de tu pedido {codigo_operacion}. Tu pedido esta siendo procesado.",
    "template_cliente_estado_en_operacion": "Hola {cliente_nombre}, tu pedido {codigo_operacion} ya esta en operacion. Te avisaremos cuando quede finalizado.",
    "template_cliente_estado_completado": "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue finalizado.\nMonto recibido: {monto_resultado}.\nComprobante: {comprobante_pago}",
    "template_cliente_estado_cancelado": "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue cancelado. Observaciones: {observaciones}",
    "template_cliente_estado_error": "Hola {cliente_nombre}, tu pedido {codigo_operacion} requiere revision. El equipo de El Jireh te contactara por este chat.",
    "template_grupo_finalizado": "*Operacion finalizada*\nCodigo: {codigo_operacion}\nOperador: {operador}\nServicio: {servicio}\nCliente: {cliente_nombre} ({cliente_telefono})\nPago: {monto_pago} {moneda_pago} por {metodo_pago}\nCuenta de pago: {cuenta_pago}\nRecibe: {monto_resultado}\nTasa: {tasa_final}\nGanancia: {ganancia}\nComprobante: {comprobante_pago}",
    "template_finalizacion_sin_comprobante": DEFAULT_FINALIZACION_SIN_COMPROBANTE,
}

DEFAULT_OPERATION_TEMPLATES = {
    "template_transferencia": "*Transferencia*\n*Operador:* {operador}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Observaciones:* {observaciones}",
    "template_efectivo": "*Efectivo*\n*Operador:* {operador}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}",
    "template_saldo": "*Saldo Movil*\n*Operador:* {operador}\n*Telefono destinatario:* {telefono_destinatario}\n*Saldo:* {saldo_cup} CUP\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}",
    "template_divisa": "*Divisa*\n*Operador:* {operador}\n*Tipo de tarjeta:* {tipo_tarjeta}\n*Numero de tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto divisa:* {monto_divisa}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Tasa efectiva:* {tasa_final}",
    "template_otros": "*Otros*\n*Operador:* {operador}\n*Cliente:* {cliente_nombre}\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Punto de recogida:* {punto_recogida}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Cuenta de pago:* {cuenta_pago}\n*Observaciones:* {informacion_operacion}",
}


def asegurar_templates_default(db: Session):
    legacy_templates = {
        **LEGACY_OPERATION_TEMPLATES,
        **LEGACY_NOTIFICATION_TEMPLATES,
    }
    for clave, valor in {
        **DEFAULT_OPERATION_TEMPLATES,
        **DEFAULT_NOTIFICATION_TEMPLATES,
    }.items():
        existe = db.query(Configuracion).filter(Configuracion.clave == clave).first()
        if not existe:
            db.add(Configuracion(clave=clave, valor=valor))
        elif existe.valor in legacy_templates.get(clave, ()):
            existe.valor = valor
    db.flush()


def listar_templates(
    db: Session
):

    asegurar_templates_default(db)
    db.commit()

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
