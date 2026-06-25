from sqlalchemy.orm import Session
from sqlalchemy import or_

from datetime import datetime
from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_saldo import PedidoSaldo
from Backend.models.pedido_transferencia import PedidoTransferencia
from Backend.models.pedido_otros import PedidoOtros
from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.operador import Operador
from Backend.models.punto_recogida import PuntoRecogida
from Backend.models.provincia_servicio import ProvinciaServicio

from Backend.models.pedido_historial import (PedidoHistorial)
from Backend.services.pedido_estado import (PedidoEstado)
from Backend.services.whatsapp_service import (
    generar_notificacion_estado_cliente,
    generar_notificacion_grupo_pedido,
    generar_notificacion_grupo_finalizado
)
from Backend.services.mensaje_operacion import (
    generar_mensaje_operacion
)
from Backend.services.template_service import (
    DEFAULT_FINALIZACION_SIN_COMPROBANTE,
    render_template,
    render_text_template
)

ESTADOS_ALIASES = {
    "pendiente": PedidoEstado.PENDIENTE_PAGO,
    "pendiente_pago": PedidoEstado.PENDIENTE_PAGO,
    "en_proceso": PedidoEstado.EN_OPERACION,
    "realizado": PedidoEstado.COMPLETADO,
    "finalizado": PedidoEstado.COMPLETADO,
    "error_operacion": PedidoEstado.ERROR,
}

ESTADOS_PERMITIDOS = (
    set(
        PedidoEstado.TODOS
    )
    | set(
        ESTADOS_ALIASES
    )
)


def _punto_recogida_data(
    punto: PuntoRecogida | None
):
    if not punto:
        return None

    return {
        "id": punto.id,
        "nombre": punto.nombre,
        "direccion": punto.direccion,
        "telefono": punto.telefono,
        "provincia_nombre": punto.provincia_nombre,
    }

ESTADOS_TERMINALES = {
    PedidoEstado.COMPLETADO,
    PedidoEstado.CANCELADO,
}


def _validar_pedido_operable(pedido: Pedido):
    if pedido.estado in ESTADOS_TERMINALES:
        raise Exception(
            "Las ordenes completadas o canceladas son solo de consulta"
        )


def _utcnow():
    return datetime.utcnow()


def _lock_activo(
    pedido: Pedido,
    now: datetime | None = None
):
    return bool(
        pedido.estado not in ESTADOS_TERMINALES
        and
        pedido.operador_asignado_id
    )


def _operador_puede_tomar_bloqueo(
    operador: Operador | None
):
    if not operador:
        return False

    return (
        operador.rol in ("admin", "supervisor")
        or "empresa:control_total" in operador.permisos
    )


def _operador_puede_ver_todos_los_pedidos(
    operador: Operador | None
):
    if not operador:
        return False

    return (
        operador.rol in ("admin", "supervisor")
        or "pedidos:ver" in operador.permisos
        or "pedidos:gestionar" in operador.permisos
        or "empresa:control_total" in operador.permisos
    )


def _pedido_pertenece_a_operador(
    pedido: Pedido,
    operador: Operador | None
):
    if not operador:
        return False

    return operador.id in (
        pedido.operador_id,
        pedido.operador_asignado_id,
        pedido.redirigido_a_operador_id
    )


def _filtro_mis_pedidos(
    operador: Operador
):
    return or_(
        Pedido.operador_id == operador.id,
        Pedido.operador_asignado_id == operador.id,
        Pedido.redirigido_a_operador_id == operador.id
    )


def _operador_asignado_nombre(
    db: Session,
    operador_id: int | None
):
    if not operador_id:
        return None

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id == operador_id
        )
        .first()
    )

    return operador.nombre if operador else None


def _operadores_nombre_ids(
    db: Session,
    operador_ids
):
    ids = {
        operador_id
        for operador_id in operador_ids
        if operador_id
    }
    if not ids:
        return {}

    return {
        operador.id: operador.nombre
        for operador in (
            db.query(
                Operador
            )
            .filter(
                Operador.id.in_(ids)
            )
            .all()
        )
    }


def _puntos_recogida_map(
    db: Session,
    punto_ids
):
    ids = {
        punto_id
        for punto_id in punto_ids
        if punto_id
    }
    if not ids:
        return {}

    return {
        punto.id: _punto_recogida_data(punto)
        for punto in (
            db.query(PuntoRecogida)
            .filter(PuntoRecogida.id.in_(ids))
            .all()
        )
    }


def _punto_recogida_dict(
    db: Session,
    punto_recogida_id: int | None
):
    return _puntos_recogida_map(
        db,
        (punto_recogida_id,)
    ).get(punto_recogida_id)


def _redireccion_dict(
    db: Session,
    pedido: Pedido,
    operadores_nombre: dict[int, str] | None = None
):
    operadores_nombre = operadores_nombre or {}
    return {
        "redirigido_a_operador_id": pedido.redirigido_a_operador_id,
        "redirigido_a_operador_nombre": operadores_nombre.get(
            pedido.redirigido_a_operador_id
        ) or _operador_asignado_nombre(
            db,
            pedido.redirigido_a_operador_id
        ),
        "redirigido_por_operador_id": pedido.redirigido_por_operador_id,
        "redirigido_por_operador_nombre": operadores_nombre.get(
            pedido.redirigido_por_operador_id
        ) or _operador_asignado_nombre(
            db,
            pedido.redirigido_por_operador_id
        ),
        "redirigido_en": pedido.redirigido_en,
        "redireccion_mensaje": pedido.redireccion_mensaje,
    }


def _lock_dict(
    db: Session,
    pedido: Pedido,
    operadores_nombre: dict[int, str] | None = None
):
    operadores_nombre = operadores_nombre or {}
    lock_activo = _lock_activo(
        pedido
    )
    return {
        "operador_asignado_id": pedido.operador_asignado_id,
        "operador_asignado_nombre": operadores_nombre.get(
            pedido.operador_asignado_id
        ) or _operador_asignado_nombre(
            db,
            pedido.operador_asignado_id
        ),
        "asignado_en": pedido.asignado_en,
        "lock_expires_at": pedido.lock_expires_at,
        "lock_activo": lock_activo,
    }


def validar_bloqueo_pedido(
    db: Session,
    pedido: Pedido,
    operador: Operador | None
):
    if not _lock_activo(
        pedido
    ):
        return

    if operador and pedido.operador_asignado_id == operador.id:
        return

    if _operador_puede_tomar_bloqueo(
        operador
    ):
        return

    nombre = _operador_asignado_nombre(
        db,
        pedido.operador_asignado_id
    ) or "otro operador"
    raise Exception(
        f"Esta operacion esta siendo trabajada por {nombre}."
    )


def _asignar_bloqueo(
    pedido: Pedido,
    operador: Operador
):
    now = _utcnow()
    if pedido.operador_asignado_id != operador.id:
        pedido.operador_asignado_id = operador.id
        pedido.asignado_en = now

    pedido.lock_expires_at = None


def _liberar_bloqueo(
    pedido: Pedido
):
    pedido.operador_asignado_id = None
    pedido.asignado_en = None
    pedido.lock_expires_at = None


def pedido_base_dict(
    pedido: Pedido
):
    tasa_aplicada = (
        pedido.monto_pago
        if pedido.servicio == "saldo"
        else pedido.tasa_final
    )

    return {
        "id": pedido.id,
        "codigo_operacion": pedido.codigo_operacion,
        "servicio": pedido.servicio,
        "estado": pedido.estado,
        "monto_pago": pedido.monto_pago,
        "moneda_pago": pedido.moneda_pago,
        "tasa_usada": (
            pedido.monto_pago
            if pedido.servicio == "saldo"
            else pedido.tasa_usada
        ),
        "bonificacion": pedido.bonificacion,
        "tasa_final": tasa_aplicada,
        "monto_resultado": pedido.monto_resultado,
        "ganancia": pedido.ganancia,
        "comprobante_pago": pedido.comprobante_pago,
        "observaciones": pedido.observaciones,
        "cliente_id": pedido.cliente_id,
        "operador_id": pedido.operador_id,
        "tipo_pago_id": pedido.tipo_pago_id,
        "cuenta_pago_id": pedido.cuenta_pago_id,
        "oferta_id": pedido.oferta_id,
        "fecha_pago_confirmado": pedido.fecha_pago_confirmado,
        "fecha_en_operacion": pedido.fecha_en_operacion,
        "fecha_completado": pedido.fecha_completado,
        "redirigido_a_operador_id": pedido.redirigido_a_operador_id,
        "redirigido_por_operador_id": pedido.redirigido_por_operador_id,
        "redirigido_en": pedido.redirigido_en,
        "redireccion_mensaje": pedido.redireccion_mensaje,
        "created_at": pedido.created_at,
        "updated_at": pedido.updated_at,
    }


def detalle_transferencia(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoTransferencia
        )
        .filter(
            PedidoTransferencia.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "numero_tarjeta": detalle.numero_tarjeta,
        "telefono_destinatario": detalle.telefono_destinatario,
        "monto_cup": detalle.monto_cup,
    }


def detalle_efectivo(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoEfectivo
        )
        .filter(
            PedidoEfectivo.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "monto_cup": detalle.monto_cup,
        "telefono_destinatario": detalle.telefono_destinatario,
        "punto_recogida_id": detalle.punto_recogida_id,
        "punto_recogida": _punto_recogida_dict(
            db,
            detalle.punto_recogida_id
        ),
        "documento_identidad_url": detalle.documento_identidad_url,
    }


def detalle_saldo(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoSaldo
        )
        .filter(
            PedidoSaldo.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "telefono_destinatario": detalle.telefono_destinatario,
        "saldo_cup": detalle.saldo_cup,
    }


def detalle_divisa(
    db: Session,
    pedido_id: int
):
    detalle = (
        db.query(
            PedidoDivisa
        )
        .filter(
            PedidoDivisa.pedido_id == pedido_id
        )
        .first()
    )

    if not detalle:
        return None

    return {
        "tipo_tarjeta": detalle.tipo_tarjeta,
        "numero_tarjeta": detalle.numero_tarjeta,
        "telefono_destinatario": detalle.telefono_destinatario,
        "monto_divisa": detalle.monto_divisa,
    }


def listar_archivos_dict(
    db: Session,
    pedido_id: int,
    limit: int = 8
):
    archivos = (
        db.query(
            ArchivoPedido
        )
        .filter(
            ArchivoPedido.pedido_id == pedido_id
        )
        .order_by(
            ArchivoPedido.created_at.desc(),
            ArchivoPedido.id.desc()
        )
        .limit(
            limit
        )
        .all()
    )

    return [
        {
            "id": archivo.id,
            "tipo": archivo.tipo,
            "ruta_archivo": archivo.ruta_archivo,
            "nombre_archivo": archivo.nombre_archivo,
            "mime_type": archivo.mime_type,
            "notas": archivo.notas,
            "usuario": archivo.usuario,
            "created_at": archivo.created_at,
        }
        for archivo in archivos
    ]


def listar_historial_dict(
    db: Session,
    pedido_id: int,
    limit: int = 12
):
    historial = (
        db.query(
            PedidoHistorial
        )
        .filter(
            PedidoHistorial.pedido_id == pedido_id
        )
        .order_by(
            PedidoHistorial.created_at.asc(),
            PedidoHistorial.id.asc()
        )
        .limit(
            limit
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "estado_anterior": item.estado_anterior,
            "estado_nuevo": item.estado_nuevo,
            "usuario": item.usuario,
            "comentario": item.comentario,
            "created_at": item.created_at,
        }
        for item in historial
    ]


def detalle_otros(
    db: Session,
    pedido_id: int
):
    pedido = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.id == pedido_id
        )
        .first()
    )

    if not pedido:
        return None

    detalle = (
        db.query(PedidoOtros)
        .filter(PedidoOtros.pedido_id == pedido_id)
        .first()
    )

    return {
        "informacion_operacion": pedido.observaciones,
        "numero_tarjeta": detalle.numero_tarjeta if detalle else None,
        "telefono_destinatario": (
            detalle.telefono_destinatario if detalle else None
        ),
        "punto_recogida_id": (
            detalle.punto_recogida_id if detalle else None
        ),
        "punto_recogida": _punto_recogida_dict(
            db,
            detalle.punto_recogida_id if detalle else None
        ),
        "documento_identidad_url": (
            detalle.documento_identidad_url if detalle else None
        ),
    }


def obtener_detalle(
    db: Session,
    pedido: Pedido
):
    detalles = {
        "transferencia": detalle_transferencia,
        "efectivo": detalle_efectivo,
        "saldo": detalle_saldo,
        "divisa": detalle_divisa,
        "otros": detalle_otros,
    }

    resolver = detalles.get(
        pedido.servicio
    )

    if not resolver:
        return None

    return resolver(
        db,
        pedido.id
    )


def _operadores_nombre_map(
    db: Session,
    pedidos: list[Pedido]
):
    operador_ids = {
        operador_id
        for pedido in pedidos
        for operador_id in (
            pedido.operador_asignado_id,
            pedido.redirigido_a_operador_id,
            pedido.redirigido_por_operador_id
        )
        if operador_id
    }

    if not operador_ids:
        return {}

    return dict(
        db.query(
            Operador.id,
            Operador.nombre
        )
        .filter(
            Operador.id.in_(
                operador_ids
            )
        )
        .all()
    )


def _detalles_por_pedido_map(
    db: Session,
    pedidos: list[Pedido]
):
    detalles: dict[int, dict] = {}
    ids_por_servicio: dict[str, list[int]] = {}

    for pedido in pedidos:
        ids_por_servicio.setdefault(
            pedido.servicio,
            []
        ).append(
            pedido.id
        )

    otros_ids = ids_por_servicio.get(
        "otros",
        []
    )
    if otros_ids:
        detalles_otros_lista = (
            db.query(PedidoOtros)
            .filter(PedidoOtros.pedido_id.in_(otros_ids))
            .all()
        )
        detalles_otros = {
            detalle.pedido_id: detalle
            for detalle in detalles_otros_lista
        }
        puntos_otros = _puntos_recogida_map(
            db,
            (
                detalle.punto_recogida_id
                for detalle in detalles_otros_lista
            )
        )
        pedidos_por_id = {
            pedido.id: pedido
            for pedido in pedidos
            if pedido.id in otros_ids
        }
        for pedido_id in otros_ids:
            detalle = detalles_otros.get(pedido_id)
            pedido = pedidos_por_id[pedido_id]
            detalles[pedido_id] = {
                "informacion_operacion": pedido.observaciones,
                "numero_tarjeta": (
                    detalle.numero_tarjeta if detalle else None
                ),
                "telefono_destinatario": (
                    detalle.telefono_destinatario if detalle else None
                ),
                "punto_recogida_id": (
                    detalle.punto_recogida_id if detalle else None
                ),
                "punto_recogida": (
                    puntos_otros.get(detalle.punto_recogida_id)
                    if detalle else None
                ),
                "documento_identidad_url": (
                    detalle.documento_identidad_url if detalle else None
                ),
            }

    transferencia_ids = ids_por_servicio.get(
        "transferencia",
        []
    )
    if transferencia_ids:
        for detalle in (
            db.query(
                PedidoTransferencia
            )
            .filter(
                PedidoTransferencia.pedido_id.in_(
                    transferencia_ids
                )
            )
            .all()
        ):
            detalles[detalle.pedido_id] = {
                "numero_tarjeta": detalle.numero_tarjeta,
                "telefono_destinatario": detalle.telefono_destinatario,
                "monto_cup": detalle.monto_cup,
            }

    efectivo_ids = ids_por_servicio.get(
        "efectivo",
        []
    )
    if efectivo_ids:
        detalles_efectivo = (
            db.query(
                PedidoEfectivo
            )
            .filter(
                PedidoEfectivo.pedido_id.in_(
                    efectivo_ids
                )
            )
            .all()
        )
        puntos_efectivo = _puntos_recogida_map(
            db,
            (
                detalle.punto_recogida_id
                for detalle in detalles_efectivo
            )
        )
        for detalle in detalles_efectivo:
            detalles[detalle.pedido_id] = {
                "monto_cup": detalle.monto_cup,
                "telefono_destinatario": detalle.telefono_destinatario,
                "punto_recogida_id": detalle.punto_recogida_id,
                "punto_recogida": puntos_efectivo.get(
                    detalle.punto_recogida_id
                ),
                "documento_identidad_url": detalle.documento_identidad_url,
            }

    saldo_ids = ids_por_servicio.get(
        "saldo",
        []
    )
    if saldo_ids:
        for detalle in (
            db.query(
                PedidoSaldo
            )
            .filter(
                PedidoSaldo.pedido_id.in_(
                    saldo_ids
                )
            )
            .all()
        ):
            detalles[detalle.pedido_id] = {
                "telefono_destinatario": detalle.telefono_destinatario,
                "saldo_cup": detalle.saldo_cup,
            }

    divisa_ids = ids_por_servicio.get(
        "divisa",
        []
    )
    if divisa_ids:
        for detalle in (
            db.query(
                PedidoDivisa
            )
            .filter(
                PedidoDivisa.pedido_id.in_(
                    divisa_ids
                )
            )
            .all()
        ):
            detalles[detalle.pedido_id] = {
                "tipo_tarjeta": detalle.tipo_tarjeta,
                "numero_tarjeta": detalle.numero_tarjeta,
                "telefono_destinatario": detalle.telefono_destinatario,
                "monto_divisa": detalle.monto_divisa,
            }

    return detalles


def pedido_resumen_dict(
    pedido: Pedido,
    detalles_por_pedido: dict[int, dict],
    operadores_nombre: dict[int, str]
):
    data = pedido_base_dict(
        pedido
    )
    data["detalle"] = detalles_por_pedido.get(
        pedido.id
    )
    data.update(
        {
            "operador_asignado_id": pedido.operador_asignado_id,
            "operador_asignado_nombre": operadores_nombre.get(
                pedido.operador_asignado_id
            ),
            "asignado_en": pedido.asignado_en,
            "lock_expires_at": pedido.lock_expires_at,
            "lock_activo": _lock_activo(
                pedido
            ),
        }
    )
    data.update(
        {
            "redirigido_a_operador_id": pedido.redirigido_a_operador_id,
            "redirigido_a_operador_nombre": operadores_nombre.get(
                pedido.redirigido_a_operador_id
            ),
            "redirigido_por_operador_id": pedido.redirigido_por_operador_id,
            "redirigido_por_operador_nombre": operadores_nombre.get(
                pedido.redirigido_por_operador_id
            ),
            "redirigido_en": pedido.redirigido_en,
            "redireccion_mensaje": pedido.redireccion_mensaje,
        }
    )

    return data


def pedido_dict(
    db: Session,
    pedido: Pedido,
    incluir_detalle: bool = False
):
    data = pedido_base_dict(
        pedido
    )
    operadores_nombre = _operadores_nombre_ids(
        db,
        (
            pedido.operador_asignado_id,
            pedido.redirigido_a_operador_id,
            pedido.redirigido_por_operador_id
        )
    )

    if incluir_detalle:
        data["detalle"] = obtener_detalle(
            db,
            pedido
        )
        data["archivos"] = listar_archivos_dict(
            db,
            pedido.id
        )
        data["historial"] = listar_historial_dict(
            db,
            pedido.id
        )
        variables_finalizacion = {
            "codigo_operacion": pedido.codigo_operacion or "",
            "monto_resultado": pedido.monto_resultado,
            "servicio": pedido.servicio or "",
            "operador": _operador_asignado_nombre(
                db,
                pedido.operador_id
            ) or "",
        }
        try:
            data["mensaje_finalizacion_sin_comprobante"] = render_template(
                db,
                "template_finalizacion_sin_comprobante",
                variables_finalizacion
            )
        except Exception:
            data["mensaje_finalizacion_sin_comprobante"] = render_text_template(
                DEFAULT_FINALIZACION_SIN_COMPROBANTE,
                variables_finalizacion
            )

        mensaje_operacion = generar_mensaje_operacion(
            db=db,
            pedido=pedido
        )
        mensaje_cliente = generar_notificacion_estado_cliente(
            db,
            pedido
        )
        mensaje_grupo_pedido = generar_notificacion_grupo_pedido(
            db=db,
            mensaje_operacion=mensaje_operacion["mensaje"]
        )
        mensaje_finalizado = generar_notificacion_grupo_finalizado(
            db,
            pedido
        )
        data.update(
            {
                "mensaje_operacion": mensaje_operacion["mensaje"],
                "whatsapp_url": mensaje_operacion["whatsapp_url"],
                "mensaje_cliente_estado": mensaje_cliente["mensaje"],
                "whatsapp_estado_url": mensaje_cliente["whatsapp_url"],
                "mensaje_grupo_pedidos": mensaje_grupo_pedido["mensaje"],
                "whatsapp_grupo_pedidos_url": mensaje_grupo_pedido["whatsapp_url"],
                "mensaje_grupo_finalizado": mensaje_finalizado["mensaje"],
                "whatsapp_grupo_finalizado_url": mensaje_finalizado["whatsapp_url"],
            }
        )

    data.update(
        _lock_dict(
            db,
            pedido,
            operadores_nombre
        )
    )
    data.update(
        _redireccion_dict(
            db,
            pedido,
            operadores_nombre
        )
    )

    return data


def listar_pedidos(
    db: Session,
    estado: str | None = None,
    servicio: str | None = None,
    limit: int = 50,
    offset: int = 0,
    alcance: str = "todas",
    operador: Operador | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None
):
    query = db.query(
        Pedido
    )

    alcance_normalizado = (
        alcance
        or "todas"
    ).strip().lower()
    if alcance_normalizado not in ("mis", "todas"):
        alcance_normalizado = "todas"

    if alcance_normalizado == "mis" and operador:
        query = query.filter(
            _filtro_mis_pedidos(
                operador
            )
        )

    if estado:
        estado_normalizado = (
            estado
            .strip()
            .lower()
        )
        estado_normalizado = ESTADOS_ALIASES.get(
            estado_normalizado,
            estado_normalizado
        )

        query = query.filter(
            Pedido.estado == estado_normalizado
        )

    if servicio:
        query = query.filter(
            Pedido.servicio == servicio.strip().lower()
        )

    if fecha_desde:
        query = query.filter(
            Pedido.created_at >= fecha_desde
        )

    if fecha_hasta:
        query = query.filter(
            Pedido.created_at < fecha_hasta
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

    pedidos = (
        query
        .order_by(
            Pedido.created_at.desc(),
            Pedido.id.desc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )

    detalles_por_pedido = _detalles_por_pedido_map(
        db,
        pedidos
    )
    operadores_nombre = _operadores_nombre_map(
        db,
        pedidos
    )

    return [
        pedido_resumen_dict(
            pedido,
            detalles_por_pedido,
            operadores_nombre
        )
        for pedido in pedidos
    ]


def listar_pedidos_activos_por_cliente(
    db: Session,
    cliente_id: int,
    limit: int = 50
):
    pedidos = (
        db.query(Pedido)
        .filter(
            Pedido.cliente_id == cliente_id,
            Pedido.estado.notin_(ESTADOS_TERMINALES)
        )
        .order_by(
            Pedido.created_at.desc(),
            Pedido.id.desc()
        )
        .limit(max(1, min(limit, 200)))
        .all()
    )
    detalles_por_pedido = _detalles_por_pedido_map(db, pedidos)
    operadores_nombre = _operadores_nombre_map(db, pedidos)

    return [
        pedido_resumen_dict(
            pedido,
            detalles_por_pedido,
            operadores_nombre
        )
        for pedido in pedidos
    ]


def redirigir_pedido_operador(
    db: Session,
    codigo_operacion: str,
    operador_destino_id: int | None,
    mensaje: str | None,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion,
        for_update=True
    )
    mensaje_limpio = (mensaje or "").strip() or None

    if (
        pedido.redirigido_a_operador_id == operador_destino_id
        and pedido.redireccion_mensaje == mensaje_limpio
    ):
        return pedido_dict(
            db,
            pedido,
            incluir_detalle=True
        )

    if operador_destino_id is None:
        pedido.redirigido_a_operador_id = None
        pedido.redirigido_por_operador_id = None
        pedido.redirigido_en = None
        pedido.redireccion_mensaje = None
    else:
        destino = (
            db.query(
                Operador
            )
            .filter(
                Operador.id == operador_destino_id
            )
            .first()
        )
        if not destino or not destino.activo:
            raise Exception(
                "Operador destino no disponible."
            )

        pedido.redirigido_a_operador_id = destino.id
        pedido.redirigido_por_operador_id = operador.id
        pedido.redirigido_en = _utcnow()
        pedido.redireccion_mensaje = mensaje_limpio
        _liberar_bloqueo(
            pedido
        )

    historial = PedidoHistorial(
        pedido_id=pedido.id,
        estado_anterior=pedido.estado,
        estado_nuevo=pedido.estado,
        usuario=operador.nombre,
        comentario=(
            f"Pedido redirigido a {_operador_asignado_nombre(db, operador_destino_id)}"
            if operador_destino_id else
            "Redireccion de operador eliminada"
        )
    )
    db.add(
        historial
    )
    db.commit()
    db.refresh(
        pedido
    )
    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def obtener_pedido_por_codigo(
    db: Session,
    codigo_operacion: str,
    operador: Operador | None = None
):
    pedido = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.codigo_operacion == codigo_operacion
        )
        .first()
    )

    if not pedido:
        raise Exception(
            "Pedido no encontrado"
        )

    if (
        operador
        and not _operador_puede_ver_todos_los_pedidos(
            operador
        )
        and not _pedido_pertenece_a_operador(
            pedido,
            operador
        )
    ):
        raise PermissionError(
            "No tienes acceso a este pedido"
        )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def _obtener_modelo_pedido_por_codigo(
    db: Session,
    codigo_operacion: str,
    for_update: bool = False
):
    query = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.codigo_operacion == codigo_operacion
        )
    )
    if for_update:
        query = query.with_for_update()

    pedido = query.first()

    if not pedido:
        raise Exception(
            "Pedido no encontrado"
        )

    return pedido


def tomar_operacion_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion,
        for_update=True
    )

    _validar_pedido_operable(
        pedido
    )
    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )
    _asignar_bloqueo(
        pedido,
        operador
    )

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def renovar_bloqueo_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion,
        for_update=True
    )

    _validar_pedido_operable(
        pedido
    )
    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )
    _asignar_bloqueo(
        pedido,
        operador
    )

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def liberar_bloqueo_pedido(
    db: Session,
    codigo_operacion: str,
    operador: Operador
):
    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion,
        for_update=True
    )

    if (
        pedido.operador_asignado_id
        and pedido.operador_asignado_id != operador.id
        and not _operador_puede_tomar_bloqueo(
            operador
        )
    ):
        validar_bloqueo_pedido(
            db,
            pedido,
            operador
        )

    _liberar_bloqueo(
        pedido
    )

    db.commit()
    db.refresh(
        pedido
    )

    return pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )


def actualizar_estado_pedido(
    db: Session,
    codigo_operacion: str,
    estado: str,
    comprobante_pago: str | None = None,
    observaciones: str | None = None,
    usuario: str | None = None,
    comentario: str | None = None,
    operador: Operador | None = None,
    finalizar_sin_comprobante: bool = False,
    motivo_sin_comprobante: str | None = None
):

    estado_normalizado = (
        estado
        .strip()
        .lower()
    )

    if (
        estado_normalizado
        not in
        ESTADOS_PERMITIDOS
    ):
        raise Exception(
            "Estado no permitido. Use: "
            + ", ".join(
                sorted(
                    ESTADOS_PERMITIDOS
                )
            )
        )

    estado_normalizado = (
        ESTADOS_ALIASES.get(
            estado_normalizado,
            estado_normalizado
        )
    )

    if estado_normalizado == PedidoEstado.EN_OPERACION:
        raise Exception(
            "El estado en_operacion no se usa en la fase 1. Finaliza directamente desde pago_confirmado"
        )

    pedido = _obtener_modelo_pedido_por_codigo(
        db,
        codigo_operacion,
        for_update=True
    )

    validar_bloqueo_pedido(
        db,
        pedido,
        operador
    )

    estado_anterior = (
        pedido.estado
    )
    observaciones_limpias = (
        observaciones
        if observaciones is None
        else str(observaciones).strip()
    )

    if (
        estado_anterior == estado_normalizado
        and (
            comprobante_pago is None
            or comprobante_pago == pedido.comprobante_pago
        )
        and (
            observaciones is None
            or observaciones_limpias == (pedido.observaciones or "")
        )
        and not finalizar_sin_comprobante
        and not motivo_sin_comprobante
    ):
        db.commit()
        db.refresh(
            pedido
        )
        return pedido_dict(
            db,
            pedido,
            incluir_detalle=True
        )

    motivo_finalizacion_idempotente = (
        motivo_sin_comprobante
        or ""
    ).strip()
    nota_finalizacion_idempotente = (
        "Operacion finalizada sin comprobante: "
        + motivo_finalizacion_idempotente
    )
    if (
        estado_anterior == estado_normalizado == PedidoEstado.COMPLETADO
        and finalizar_sin_comprobante
        and len(motivo_finalizacion_idempotente) >= 10
        and nota_finalizacion_idempotente in (pedido.observaciones or "")
    ):
        db.commit()
        db.refresh(
            pedido
        )
        return pedido_dict(
            db,
            pedido,
            incluir_detalle=True
        )

    if operador:
        _asignar_bloqueo(
            pedido,
            operador
        )

    if (
        observaciones
        is not None
    ):
        pedido.observaciones = (
            observaciones_limpias
        )

    comentario_historial = comentario
    if (
        estado_normalizado
        ==
        PedidoEstado.COMPLETADO
    ):
        tiene_comprobante_final = (
            db.query(
                ArchivoPedido.id
            )
            .filter(
                ArchivoPedido.pedido_id == pedido.id,
                ArchivoPedido.tipo == "comprobante_final"
            )
            .first()
            is not None
        )
        motivo_finalizacion = (
            motivo_sin_comprobante
            or ""
        ).strip()

        if not tiene_comprobante_final and not finalizar_sin_comprobante:
            raise Exception(
                "Sube el comprobante de exito de la operacion o activa la finalizacion sin comprobante"
            )

        if finalizar_sin_comprobante and len(
            motivo_finalizacion
        ) < 10:
            raise Exception(
                "Explica por que no se pudo obtener el comprobante final"
            )

        if finalizar_sin_comprobante:
            nota_finalizacion = (
                "Operacion finalizada sin comprobante: "
                + motivo_finalizacion
            )
            pedido.observaciones = " | ".join(
                parte
                for parte in [
                    pedido.observaciones,
                    nota_finalizacion
                ]
                if parte
            )
            comentario_historial = nota_finalizacion

    pedido.estado = (
        estado_normalizado
    )

    estado_cambio = (
        estado_anterior
        !=
        estado_normalizado
    )

    # comprobante opcional

    if (
        comprobante_pago
        is not None
    ):
        pedido.comprobante_pago = (
            comprobante_pago
        )

    if (
        estado_normalizado
        ==
        PedidoEstado.PAGO_CONFIRMADO
        and not pedido.comprobante_pago
    ):
        raise Exception(
            "Sube un comprobante de pago antes de confirmar el pago"
        )

    # timestamps automáticos

    if (
        estado_normalizado
        ==
        PedidoEstado.PAGO_CONFIRMADO
    ):
        pedido.fecha_pago_confirmado = (
            datetime.utcnow()
        )

    elif (
        estado_normalizado
        ==
        PedidoEstado.COMPLETADO
    ):
        pedido.fecha_completado = (
            datetime.utcnow()
        )

    # historial

    historial = (
        PedidoHistorial(
            pedido_id=
            pedido.id,

            estado_anterior=
            estado_anterior,

            estado_nuevo=
            estado_normalizado,

            usuario=
            usuario,

            comentario=
            comentario_historial
        )
    )

    db.add(
        historial
    )

    if estado_cambio:
        _liberar_bloqueo(
            pedido
        )

    db.commit()

    db.refresh(
        pedido
    )

    data = pedido_dict(
        db,
        pedido,
        incluir_detalle=True
    )

    mensaje_cliente = generar_notificacion_estado_cliente(
        db,
        pedido
    )
    mensaje_grupo_pedido = {
        "mensaje": None,
        "whatsapp_url": None
    }
    if (
        estado_normalizado
        ==
        PedidoEstado.PAGO_CONFIRMADO
    ):
        mensaje_operacion = generar_mensaje_operacion(
            db=db,
            pedido=pedido
        )
        mensaje_grupo_pedido = generar_notificacion_grupo_pedido(
            db=db,
            mensaje_operacion=mensaje_operacion["mensaje"]
        )

    mensaje_finalizado = generar_notificacion_grupo_finalizado(
        db,
        pedido
    )

    data.update({
        "mensaje_cliente_estado": mensaje_cliente["mensaje"],
        "whatsapp_estado_url": mensaje_cliente["whatsapp_url"],
        "mensaje_grupo_pedidos": mensaje_grupo_pedido["mensaje"],
        "whatsapp_grupo_pedidos_url": mensaje_grupo_pedido["whatsapp_url"],
        "mensaje_grupo_finalizado": mensaje_finalizado["mensaje"],
        "whatsapp_grupo_finalizado_url": mensaje_finalizado["whatsapp_url"],
    })

    return data
