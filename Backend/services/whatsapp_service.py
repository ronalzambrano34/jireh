from urllib.parse import quote

from sqlalchemy.orm import Session

from Backend.models.cliente import Cliente
from Backend.models.metodo_pago import MetodoPago
from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_saldo import PedidoSaldo
from Backend.models.pedido_transferencia import PedidoTransferencia
from Backend.services.config_service import obtener_config
from Backend.services.pedido_estado import PedidoEstado
from Backend.services.template_service import render_template, render_text_template

WHATSAPP_GRUPO_PEDIDOS_KEY = "whatsapp_grupo_pedidos_url"
WHATSAPP_GRUPO_FINALIZADOS_KEY = "whatsapp_grupo_finalizados_url"

DEFAULT_TEMPLATES_ESTADO = {
    "template_cliente_estado_pendiente_pago": (
        "Hola {cliente_nombre}, tu pedido {codigo_operacion} esta pendiente de pago. "
        "Monto a pagar: {monto_pago} {moneda_pago}."
    ),
    "template_cliente_estado_pago_confirmado": (
        "Hola {cliente_nombre}, confirmamos el pago de tu pedido {codigo_operacion}. "
        "Tu pedido esta siendo procesado."
    ),
    "template_cliente_estado_en_operacion": (
        "Hola {cliente_nombre}, tu pedido {codigo_operacion} ya esta en operacion. "
        "Te avisaremos cuando quede finalizado."
    ),
    "template_cliente_estado_completado": (
        "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue finalizado.\n"
        "Monto recibido: {monto_resultado}.\n"
        "Comprobante: {comprobante_pago}"
    ),
    "template_cliente_estado_cancelado": (
        "Hola {cliente_nombre}, tu pedido {codigo_operacion} fue cancelado. "
        "Observaciones: {observaciones}"
    ),
    "template_cliente_estado_error": (
        "Hola {cliente_nombre}, tu pedido {codigo_operacion} requiere revision. "
        "El equipo de El Jireh te contactara por este chat."
    ),
    "template_grupo_finalizado": (
        "*Operacion finalizada*\n"
        "Codigo: {codigo_operacion}\n"
        "Servicio: {servicio}\n"
        "Cliente: {cliente_nombre} ({cliente_telefono})\n"
        "Pago: {monto_pago} {moneda_pago} por {metodo_pago}\n"
        "Recibe: {monto_resultado}\n"
        "Tasa: {tasa_final}\n"
        "Ganancia: {ganancia}\n"
        "Comprobante: {comprobante_pago}"
    ),
}


def crear_whatsapp_url(destino: str | None, mensaje: str):
    texto = quote(mensaje)
    destino = (destino or "").strip()

    if not destino:
        return "https://wa.me/?text=" + texto

    if "{mensaje}" in destino:
        return destino.replace("{mensaje}", texto)

    destino_lower = destino.lower()
    if (
        "wa.me/" in destino_lower
        or "api.whatsapp.com/send" in destino_lower
        or "web.whatsapp.com/send" in destino_lower
        or destino_lower.startswith("whatsapp://send")
    ):
        separador = "&" if "?" in destino else "?"
        return destino + separador + "text=" + texto

    # Los links de invitacion de grupo (chat.whatsapp.com) no aceptan texto precargado.
    return destino


def cliente_whatsapp_url(cliente: Cliente | None, mensaje: str):
    if not cliente or not cliente.telefono:
        return None

    digits = "".join(ch for ch in cliente.telefono if ch.isdigit())
    if not digits:
        return None

    return "https://wa.me/" + digits + "?text=" + quote(mensaje)


def _cliente(db: Session, pedido: Pedido):
    if not pedido.cliente_id:
        return None
    return db.query(Cliente).filter(Cliente.id == pedido.cliente_id).first()


def _metodo_pago(db: Session, pedido: Pedido):
    if not pedido.tipo_pago_id:
        return None
    return db.query(MetodoPago).filter(MetodoPago.id == pedido.tipo_pago_id).first()


def _detalle(db: Session, pedido: Pedido):
    if pedido.servicio == "transferencia":
        item = db.query(PedidoTransferencia).filter(PedidoTransferencia.pedido_id == pedido.id).first()
        return {
            "numero_tarjeta": item.numero_tarjeta if item else "",
            "telefono_destinatario": item.telefono_destinatario if item else "",
            "monto_cup": item.monto_cup if item else "",
        }

    if pedido.servicio == "efectivo":
        item = db.query(PedidoEfectivo).filter(PedidoEfectivo.pedido_id == pedido.id).first()
        return {
            "telefono_destinatario": item.telefono_destinatario if item else "",
            "monto_cup": item.monto_cup if item else "",
            "documento_identidad_url": item.documento_identidad_url if item else "",
            "punto_recogida_id": item.punto_recogida_id if item else "",
        }

    if pedido.servicio == "saldo":
        item = db.query(PedidoSaldo).filter(PedidoSaldo.pedido_id == pedido.id).first()
        return {
            "telefono_destinatario": item.telefono_destinatario if item else "",
            "saldo_cup": item.saldo_cup if item else "",
        }

    if pedido.servicio == "divisa":
        item = db.query(PedidoDivisa).filter(PedidoDivisa.pedido_id == pedido.id).first()
        return {
            "tipo_tarjeta": item.tipo_tarjeta if item else "",
            "numero_tarjeta": item.numero_tarjeta if item else "",
            "telefono_destinatario": item.telefono_destinatario if item else "",
            "monto_divisa": item.monto_divisa if item else "",
        }

    return {}


def contexto_pedido(db: Session, pedido: Pedido):
    cliente = _cliente(db, pedido)
    metodo = _metodo_pago(db, pedido)
    data = {
        "codigo_operacion": pedido.codigo_operacion or "",
        "servicio": pedido.servicio or "",
        "estado": pedido.estado or "",
        "cliente_nombre": cliente.nombre if cliente else "Cliente",
        "cliente_telefono": cliente.telefono if cliente else "",
        "monto_pago": pedido.monto_pago,
        "moneda_pago": pedido.moneda_pago,
        "monto_resultado": pedido.monto_resultado,
        "tasa_final": pedido.tasa_final,
        "ganancia": pedido.ganancia,
        "metodo_pago": metodo.nombre if metodo else "",
        "comprobante_pago": pedido.comprobante_pago or "Pendiente",
        "observaciones": pedido.observaciones or "",
    }
    data.update(_detalle(db, pedido))
    return data, cliente


def render_template_con_default(db: Session, clave: str, default: str, variables: dict):
    try:
        return render_template(db, clave, variables)
    except Exception:
        return render_text_template(default, variables)


def generar_notificacion_grupo_pedido(db: Session, mensaje_operacion: str):
    destino = obtener_config(db, WHATSAPP_GRUPO_PEDIDOS_KEY, "")
    if not (destino or "").strip():
        return {
            "mensaje": mensaje_operacion,
            "whatsapp_url": None,
        }

    return {
        "mensaje": mensaje_operacion,
        "whatsapp_url": crear_whatsapp_url(destino, mensaje_operacion),
    }


def generar_notificacion_estado_cliente(db: Session, pedido: Pedido):
    variables, cliente = contexto_pedido(db, pedido)
    clave = "template_cliente_estado_" + pedido.estado
    default = DEFAULT_TEMPLATES_ESTADO.get(clave)

    if not default:
        default = (
            "Hola {cliente_nombre}, tu pedido {codigo_operacion} cambio de estado a {estado}."
        )

    mensaje = render_template_con_default(db, clave, default, variables)
    return {
        "mensaje": mensaje,
        "whatsapp_url": cliente_whatsapp_url(cliente, mensaje),
    }


def generar_notificacion_grupo_finalizado(db: Session, pedido: Pedido):
    if pedido.estado != PedidoEstado.COMPLETADO:
        return {"mensaje": None, "whatsapp_url": None}

    variables, _cliente_item = contexto_pedido(db, pedido)
    mensaje = render_template_con_default(
        db,
        "template_grupo_finalizado",
        DEFAULT_TEMPLATES_ESTADO["template_grupo_finalizado"],
        variables,
    )
    destino = obtener_config(db, WHATSAPP_GRUPO_FINALIZADOS_KEY, "")
    if not (destino or "").strip():
        return {
            "mensaje": mensaje,
            "whatsapp_url": None,
        }

    return {
        "mensaje": mensaje,
        "whatsapp_url": crear_whatsapp_url(destino, mensaje),
    }
