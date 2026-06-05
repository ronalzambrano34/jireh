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

DEFAULT_FINALIZACION_SIN_COMPROBANTE = (
    "Listo, operacion exitosa para el pedido {codigo_operacion}, "
    "pero por factores ajenos a nosotros no es posible enviar el comprobante."
)

DEFAULT_NOTIFICATION_TEMPLATES = {
    "template_cliente_estado_pendiente_pago": "Hola {cliente_nombre}, tu pedido {codigo_operacion} esta pendiente de pago. Monto a pagar: {monto_pago} {moneda_pago}.",
    "template_cliente_estado_pago_confirmado": "Hola {cliente_nombre}, confirmamos el pago de tu pedido {codigo_operacion}. Tu pedido esta siendo procesado.",
    "template_cliente_estado_en_operacion": "Hola {cliente_nombre}, tu pedido {codigo_operacion} ya esta en operacion. Te avisaremos cuando quede finalizado.",
    "template_cliente_estado_completado": "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue finalizado.\nMonto recibido: {monto_resultado}.\nComprobante: {comprobante_pago}",
    "template_cliente_estado_cancelado": "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue cancelado. Observaciones: {observaciones}",
    "template_cliente_estado_error": "Hola {cliente_nombre}, tu pedido {codigo_operacion} requiere revision. El equipo de El Jireh te contactara por este chat.",
    "template_grupo_finalizado": "*Operacion finalizada*\nCodigo: {codigo_operacion}\nServicio: {servicio}\nCliente: {cliente_nombre} ({cliente_telefono})\nPago: {monto_pago} {moneda_pago} por {metodo_pago}\nRecibe: {monto_resultado}\nTasa: {tasa_final}\nGanancia: {ganancia}\nComprobante: {comprobante_pago}",
    "template_finalizacion_sin_comprobante": DEFAULT_FINALIZACION_SIN_COMPROBANTE,
}

DEFAULT_OPERATION_TEMPLATES = {
    "template_transferencia": "*Transferencia*\n*Tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
    "template_efectivo": "*Efectivo*\n*Telefono destinatario:* {telefono_destinatario}\n*Foto documento:* {documento_identidad_url}\n*Monto CUP:* {monto_resultado}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}",
    "template_saldo": "*Saldo Movil*\n*Telefono destinatario:* {telefono_destinatario}\n*Saldo:* {saldo_cup} CUP\n*Pago:* {monto_pago} {moneda_pago}",
    "template_divisa": "*Divisa*\n*Tipo de tarjeta:* {tipo_tarjeta}\n*Numero de tarjeta:* {numero_tarjeta}\n*Telefono destinatario:* {telefono_destinatario}\n*Monto divisa:* {monto_divisa}\n*Pago:* {monto_pago} {moneda_pago}\n*Tasa efectiva:* {tasa_final}",
    "template_otros": "*Otros*\n*Cliente:* {cliente_nombre}\n*Pago:* {monto_pago} {moneda_pago}\n*Metodo de pago:* {metodo_pago}\n*Info:* {observaciones}",
}


def asegurar_templates_default(db: Session):
    for clave, valor in {
        **DEFAULT_OPERATION_TEMPLATES,
        **DEFAULT_NOTIFICATION_TEMPLATES,
    }.items():
        existe = db.query(Configuracion).filter(Configuracion.clave == clave).first()
        if not existe:
            db.add(Configuracion(clave=clave, valor=valor))
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
