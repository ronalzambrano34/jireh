from urllib.parse import quote

from sqlalchemy.orm import Session

from Backend.models.pedido import Pedido
from Backend.models.pedido_historial import PedidoHistorial
from Backend.models.pedido_transferencia import (
    PedidoTransferencia
)
from Backend.models.pedido_efectivo import (
    PedidoEfectivo
)
from Backend.models.pedido_saldo import (
    PedidoSaldo
)
from Backend.models.pedido_divisa import (
    PedidoDivisa
)
from Backend.models.pedido_otros import PedidoOtros

from Backend.models.operador import (
    Operador
)
from Backend.models.cliente import (
    Cliente
)
from Backend.models.metodo_pago import (
    MetodoPago
)
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.contacto import (
    Contacto
)

from Backend.services.calculadora_oferta import (
    calcular_operacion
)

from Backend.services.generador_codigo import (
    generar_codigo_operacion
)

from Backend.services.mensaje_operacion import (
    generar_mensaje_operacion
)
from Backend.services.pedido_estado import (
    PedidoEstado
)

from Backend.services.cliente_service import (
    obtener_o_crear_cliente_por_telefono
)
from Backend.services.telefonos import (
    normalizar_telefono
)
from Backend.services.payment_service import (
    obtener_datos_pago
)
from Backend.services.whatsapp_service import (
    generar_notificacion_grupo_pedido
)
from Backend.services.template_service import (
    formatear_valor_template
)


def normalizar_telefono_destinatario(
    numero: str | None,
    requerido: bool = False
):
    if numero is None or not str(numero).strip():
        if requerido:
            raise Exception(
                "telefono_destinatario es requerido"
            )

        return None

    telefono = normalizar_telefono(
        str(numero),
        "cu"
    )

    if not telefono.startswith("+53"):
        raise Exception(
            "telefono_destinatario debe ser un numero de Cuba (+53)"
        )

    if len(telefono.removeprefix("+53")) != 8:
        raise Exception(
            "telefono_destinatario debe tener 8 digitos despues de +53"
        )

    return telefono


def normalizar_numero_tarjeta(numero: str | None) -> str | None:
    if numero is None or not str(numero).strip():
        return None

    digitos = "".join(ch for ch in str(numero) if ch.isdigit())
    return digitos or None




def _metodo_pago_key(nombre: str | None):
    value = (nombre or "").strip().lower()
    if "itau" in value or "itaú" in value:
        return "itau"
    if "brou" in value or "brow" in value:
        return "brou"
    if "prex" in value:
        return "prex"
    if "midinero" in value or "mi dinero" in value or "md" == value:
        return "midinero"
    if "pix" in value:
        return "pix"
    return value


def _cliente_whatsapp_url(cliente: Cliente | None, mensaje: str):
    if not cliente or not cliente.telefono:
        return None

    digits = "".join(ch for ch in cliente.telefono if ch.isdigit())
    if not digits:
        return None

    return "https://wa.me/" + digits + "?text=" + quote(mensaje)


def _generar_mensaje_pago_cliente(
    db: Session,
    pedido: Pedido,
    cliente: Cliente,
    metodo_pago: MetodoPago
):
    try:
        datos_pago = obtener_datos_pago(
            db,
            pedido.moneda_pago,
            _metodo_pago_key(metodo_pago.nombre),
            metodo_pago=metodo_pago,
            cuenta_pago=(
                db.query(MetodoPagoCuenta)
                .filter(MetodoPagoCuenta.id == pedido.cuenta_pago_id)
                .first()
                if pedido.cuenta_pago_id
                else None
            )
        )
    except Exception:
        datos_pago = {
            "metodo_pago": metodo_pago.nombre,
            "cuenta_pago": "Por confirmar",
            "titular_pago": "El Jireh"
        }

    mensaje = (
        "*El Jireh - Instrucciones de pago*\n"
        f"Hola {cliente.nombre}, tu pedido {pedido.codigo_operacion} fue recibido.\n"
        f"*Monto a pagar:* {formatear_valor_template(pedido.monto_pago)} {pedido.moneda_pago}\n"
        f"*Metodo:* {datos_pago.get('metodo_pago') or metodo_pago.nombre}\n"
        f"*Cuenta:* {datos_pago.get('cuenta_pago') or 'Por confirmar'}\n"
        f"*Titular:* {datos_pago.get('titular_pago') or 'El Jireh'}\n"
        "Cuando realices el pago, envia el comprobante por este chat para confirmar la orden."
    )

    return {
        "mensaje": mensaje,
        "whatsapp_url": _cliente_whatsapp_url(
            cliente,
            mensaje
        ),
        "datos_pago": {
            "metodo_pago": datos_pago.get("metodo_pago") or metodo_pago.nombre,
            "cuenta_pago": datos_pago.get("cuenta_pago") or "Por confirmar",
            "titular_pago": datos_pago.get("titular_pago") or "El Jireh",
            "qr_pago_url": datos_pago.get("qr_pago_url")
        }
    }


def _valor_vacio(
    valor
):
    return valor is None or not str(valor).strip()


def _aplicar_contacto_a_pedido(
    data: dict,
    contacto: Contacto | None
):
    if not contacto:
        return

    campos = {
        "telefono_destinatario": contacto.telefono,
        "numero_tarjeta": contacto.numero_tarjeta,
        "tipo_tarjeta": contacto.tipo_tarjeta,
        "documento_identidad_url": contacto.documento_identidad_url,
    }

    for campo, valor in campos.items():
        if _valor_vacio(
            data.get(
                campo
            )
        ) and not _valor_vacio(
            valor
        ):
            data[campo] = valor


def _nombre_contacto_frecuente(
    telefono: str | None,
    numero_tarjeta: str | None
):
    if telefono:
        return "Destinatario " + telefono

    if numero_tarjeta:
        return "Tarjeta " + numero_tarjeta[-4:]

    return "Destinatario frecuente"


def _documento_contacto_valido(
    value: str | None
):
    if _valor_vacio(value):
        return None

    texto = str(value).strip()
    if texto.lower().startswith("documento adjunto"):
        return None

    return texto


def _guardar_contacto_frecuente(
    db: Session,
    cliente: Cliente,
    data: dict,
    contacto: Contacto | None
):
    telefono = normalizar_telefono_destinatario(
        data.get(
            "telefono_destinatario"
        )
    )
    numero_tarjeta = normalizar_numero_tarjeta(
        data.get(
            "numero_tarjeta"
        )
    )
    tipo_tarjeta = (
        data.get(
            "tipo_tarjeta"
        )
        or None
    )
    documento_identidad_url = _documento_contacto_valido(
        data.get(
            "documento_identidad_url"
        )
    )

    if (
        not telefono
        and not numero_tarjeta
        and not documento_identidad_url
    ):
        return None

    contacto_existente = contacto

    if not contacto_existente and telefono:
        contacto_existente = (
            db.query(
                Contacto
            )
            .filter(
                Contacto.cliente_id
                ==
                cliente.id,
                Contacto.telefono
                ==
                telefono
            )
            .first()
        )

    if not contacto_existente and numero_tarjeta:
        contacto_existente = (
            db.query(
                Contacto
            )
            .filter(
                Contacto.cliente_id
                ==
                cliente.id,
                Contacto.numero_tarjeta
                ==
                numero_tarjeta
            )
            .first()
        )

    if contacto_existente:
        contacto_existente.cliente_id = cliente.id
        contacto_existente.activo = True
        if telefono:
            contacto_existente.telefono = telefono
        if numero_tarjeta:
            contacto_existente.numero_tarjeta = numero_tarjeta
        if tipo_tarjeta:
            contacto_existente.tipo_tarjeta = tipo_tarjeta
        if documento_identidad_url:
            contacto_existente.documento_identidad_url = (
                documento_identidad_url
            )
        if (
            not contacto_existente.nombre
            or contacto_existente.nombre.startswith(
                "Destinatario "
            )
            or contacto_existente.nombre.startswith(
                "Tarjeta "
            )
        ):
            contacto_existente.nombre = _nombre_contacto_frecuente(
                telefono,
                numero_tarjeta
            )
        return contacto_existente

    contacto_nuevo = Contacto(
        cliente_id=cliente.id,
        nombre=_nombre_contacto_frecuente(
            telefono,
            numero_tarjeta
        ),
        telefono=telefono,
        numero_tarjeta=numero_tarjeta,
        tipo_tarjeta=tipo_tarjeta,
        documento_identidad_url=documento_identidad_url,
        pais="Cuba",
        activo=True
    )
    db.add(
        contacto_nuevo
    )
    return contacto_nuevo




def _validar_datos_servicio(
    data: dict
):
    servicio = data.get(
        "servicio"
    )

    if servicio == "transferencia":
        if _valor_vacio(
            data.get(
                "numero_tarjeta"
            )
        ):
            raise Exception(
                "numero_tarjeta es requerido"
            )

        normalizar_telefono_destinatario(
            data.get(
                "telefono_destinatario"
            )
        )

    elif servicio == "efectivo":
        if _valor_vacio(
            data.get(
                "documento_identidad_url"
            )
        ):
            raise Exception(
                "La foto o referencia del documento de identidad es requerida"
            )

        normalizar_telefono_destinatario(
            data.get(
                "telefono_destinatario"
            ),
            requerido=True
        )

    elif servicio == "saldo":
        normalizar_telefono_destinatario(
            data.get(
                "telefono_destinatario"
            ),
            requerido=True
        )

    elif servicio == "divisa":
        if _valor_vacio(
            data.get(
                "tipo_tarjeta"
            )
        ):
            raise Exception(
                "tipo_tarjeta es requerido"
            )

        if _valor_vacio(
            data.get(
                "numero_tarjeta"
            )
        ):
            raise Exception(
                "numero_tarjeta es requerido"
            )

        normalizar_telefono_destinatario(
            data.get(
                "telefono_destinatario"
            )
        )

    elif servicio == "otros":
        normalizar_telefono_destinatario(
            data.get(
                "telefono_destinatario"
            )
        )


def crear_pedido(
    db: Session,
    data: dict
):

    if "numero_tarjeta" in data:
        data["numero_tarjeta"] = normalizar_numero_tarjeta(
            data.get(
                "numero_tarjeta"
            )
        )

    if (
        data["servicio"]
        ==
        "otros"
    ):

        monto_pago = float(
            data["monto_pago"]
        )

        if monto_pago <= 0:
            raise Exception(
                "El monto_pago debe ser mayor que cero"
            )

        calculo = {

            "oferta_id":
            None,

            "tasa":
            1,

            "bonificacion":
            0,

            "tasa_final":
            1,

            "monto_resultado":
            monto_pago,

            "ganancia":
            0
        }

    elif (
        data["servicio"]
        ==
        "saldo"
    ):

        monto_pago = float(
            data["monto_pago"]
        )

        saldo_cup = float(
            data["saldo_cup"]
        )

        tasa_saldo = saldo_cup / monto_pago
        bonificacion = float(
            data.get(
                "bonificacion_manual",
                0
            ) or 0
        )
        saldo_final = round(
            monto_pago * (
                tasa_saldo + bonificacion
            )
        )

        calculo = {

            "oferta_id":
            None,

            "tasa":
            monto_pago,

            "bonificacion":
            bonificacion,

            "tasa_final":
            monto_pago,

            "monto_resultado":
            saldo_final,

            "ganancia":
            0
        }

    elif (
        data["servicio"]
        ==
        "divisa"
    ):

        monto_pago = float(
            data["monto_pago"]
        )

        if monto_pago <= 0:
            raise Exception(
                "El monto_pago debe ser mayor que cero"
            )

        tipo_tarjeta = str(
            data.get("tipo_tarjeta") or ""
        ).strip().lower()

        servicio_divisa = {
            "mlc": "mlc",
            "usd": "usd",
            "clasica": "clasica",
            "clásica": "clasica"
        }.get(tipo_tarjeta)

        if not servicio_divisa:
            raise Exception(
                "Tipo de tarjeta no soportado"
            )

        calculo = calcular_operacion(
            db=db,
            servicio=servicio_divisa,
            moneda_pago=data["moneda_pago"],
            monto_pago=monto_pago,
            bonificacion_manual=data.get(
                "bonificacion_manual",
                0
            )
        )

    else:

        calculo = (
            calcular_operacion(
                db=db,

                servicio=
                data["servicio"],

                moneda_pago=
                data["moneda_pago"],

                monto_pago=
                data["monto_pago"],

                bonificacion_manual=
                data.get(
                    "bonificacion_manual",
                    0
                )
            )
        )

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.id
            ==
            data[
                "operador_id"
            ]
        )
        .first()
    )

    if not operador:

        raise Exception(
            "Operador no encontrado"
        )

    cliente = None
    contacto = None

    if data.get(
        "contacto_id"
    ):
        contacto = (
            db.query(
                Contacto
            )
            .filter(
                Contacto.id
                == data[
                    "contacto_id"
                ],
                Contacto.activo
                == True
            )
            .first()
        )

        if not contacto:
            raise Exception(
                "Contacto no encontrado"
            )

    # Buscar cliente por teléfono si se proporciona
    if data.get("numero_telefono_cliente"):
        cliente = (
            obtener_o_crear_cliente_por_telefono(
                db=db,
                numero_telefono=(
                    data["numero_telefono_cliente"]
                ),
                nombre=data.get(
                    "nombre_cliente"
                ),
                pais=data.get(
                    "moneda_pago",
                    "br"
                )
            )
        )

    # Si no, buscar por cliente_id
    elif data.get("cliente_id"):
        cliente = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.id
                ==
                data[
                    "cliente_id"
                ]
            )
            .first()
        )

    elif contacto and contacto.cliente_id:
        cliente = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.id
                == contacto.cliente_id
            )
            .first()
        )

    else:
        raise Exception(
            "El cliente es obligatorio. Selecciona un cliente o escribe su telefono/WhatsApp"
        )

    if not cliente:

        raise Exception(
            "Cliente no encontrado o no pudo ser creado"
        )

    if not cliente.telefono:
        raise Exception(
            "El cliente debe tener telefono/WhatsApp para enviar instrucciones de pago"
        )

    if (
        contacto
        and contacto.cliente_id
        and contacto.cliente_id != cliente.id
    ):
        raise Exception(
            "El contacto no pertenece al cliente del pedido"
        )

    _aplicar_contacto_a_pedido(
        data,
        contacto
    )

    metodo_pago = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.id
            ==
            data[
                "tipo_pago_id"
            ],
            MetodoPago.activo
            == True
        )
        .first()
    )

    if not metodo_pago:

        raise Exception(
            "Metodo de pago no encontrado"
        )

    if (
        metodo_pago.moneda
        and
        metodo_pago.moneda.upper()
        !=
        data["moneda_pago"].upper()
    ):
        raise Exception(
            "El metodo de pago no corresponde a la moneda del pedido"
        )

    cuenta_pago = None
    cuenta_pago_id = data.get("cuenta_pago_id")
    if cuenta_pago_id is not None:
        cuenta_pago = (
            db.query(MetodoPagoCuenta)
            .filter(
                MetodoPagoCuenta.id == cuenta_pago_id,
                MetodoPagoCuenta.metodo_pago_id == metodo_pago.id,
                MetodoPagoCuenta.activa == True
            )
            .first()
        )
        if not cuenta_pago:
            raise Exception(
                "La cuenta seleccionada no pertenece al metodo de pago o esta inactiva"
            )
    else:
        cuenta_pago = (
            db.query(MetodoPagoCuenta)
            .filter(
                MetodoPagoCuenta.metodo_pago_id == metodo_pago.id,
                MetodoPagoCuenta.activa == True
            )
            .order_by(
                MetodoPagoCuenta.predeterminada.desc(),
                MetodoPagoCuenta.id.asc()
            )
            .first()
        )

    _validar_datos_servicio(
        data
    )

    codigo = (
        generar_codigo_operacion(
            codigo_operador=
            operador.codigo_operador,

            servicio=
            data[
                "servicio"
            ]
        )
    )

    pedido = Pedido(

        codigo_operacion=
        codigo,

        cliente_id=
        cliente.id,

        operador_id=
        data[
            "operador_id"
        ],

        servicio=
        data[
            "servicio"
        ],

        moneda_pago=
        data[
            "moneda_pago"
        ],

        monto_pago=
        data[
            "monto_pago"
        ],

        tipo_pago_id=
        data[
            "tipo_pago_id"
        ],

        cuenta_pago_id=
        cuenta_pago.id if cuenta_pago else None,

        oferta_id=
        calculo.get(
            "oferta_id"
        ),

        tasa_usada=
        calculo.get(
            "tasa"
        ),

        bonificacion=
        calculo.get(
            "bonificacion"
        ),

        tasa_final=
        calculo.get(
            "tasa_final"
        ),

        monto_resultado=
        calculo.get(
            "monto_resultado"
        ),

        ganancia=
        calculo.get(
            "ganancia"
        ),

        observaciones=
        data.get(
            "observaciones"
        ),

        estado=
        PedidoEstado.PENDIENTE_PAGO
    )

    db.add(
        pedido
    )

    db.flush()

    # TRANSFERENCIA

    if (
        data["servicio"]
        ==
        "transferencia"
    ):

        if _valor_vacio(
            data.get(
                "numero_tarjeta"
            )
        ):
            raise Exception(
                "numero_tarjeta es requerido"
            )

        detalle = (
            PedidoTransferencia(

                pedido_id=
                pedido.id,

                numero_tarjeta=
                data.get(
                    "numero_tarjeta"
                ),

                telefono_destinatario=
                normalizar_telefono_destinatario(
                    data.get(
                        "telefono_destinatario"
                    )
                ),

                monto_cup=
                calculo[
                    "monto_resultado"
                ]
            )
        )

        db.add(
            detalle
        )

    elif (
        data["servicio"]
        ==
        "otros"
    ):

        detalle = PedidoOtros(
            pedido_id=pedido.id,
            numero_tarjeta=data.get("numero_tarjeta") or None,
            telefono_destinatario=normalizar_telefono_destinatario(
                data.get("telefono_destinatario")
            ),
            punto_recogida_id=data.get("punto_recogida_id") or None,
            documento_identidad_url=(
                data.get("documento_identidad_url") or None
            )
        )

        db.add(
            detalle
        )

    # EFECTIVO

    elif (
        data["servicio"]
        ==
        "efectivo"
    ):

        if not data.get(
            "documento_identidad_url"
        ):
            raise Exception(
                "La foto o referencia del documento de identidad es requerida"
            )

        detalle = (
            PedidoEfectivo(

                pedido_id=
                pedido.id,

                monto_cup=
                calculo[
                    "monto_resultado"
                ],

                telefono_destinatario=
                normalizar_telefono_destinatario(
                    data.get(
                        "telefono_destinatario"
                    ),
                    requerido=True
                ),

                punto_recogida_id=
                data.get(
                    "punto_recogida_id"
                ) or None,

                documento_identidad_url=
                data.get(
                    "documento_identidad_url"
                )
            )
        )

        db.add(
            detalle
        )

    # SALDO

    elif (
        data["servicio"]
        ==
        "saldo"
    ):

        detalle = (
            PedidoSaldo(

                pedido_id=
                pedido.id,

                telefono_destinatario=
                normalizar_telefono_destinatario(
                    data.get(
                        "telefono_destinatario"
                    ),
                    requerido=True
                ),

                saldo_cup=
                calculo[
                    "monto_resultado"
                ]
            )
        )

        db.add(
            detalle
        )

    elif (
        data["servicio"]
        ==
        "divisa"
    ):

        if _valor_vacio(
            data.get(
                "tipo_tarjeta"
            )
        ):
            raise Exception(
                "tipo_tarjeta es requerido"
            )

        if _valor_vacio(
            data.get(
                "numero_tarjeta"
            )
        ):
            raise Exception(
                "numero_tarjeta es requerido"
            )

        detalle = (
            PedidoDivisa(
                pedido_id=
                pedido.id,

                tipo_tarjeta=
                data.get(
                    "tipo_tarjeta"
                ),

                numero_tarjeta=
                data.get(
                    "numero_tarjeta"
                ),

                telefono_destinatario=
                normalizar_telefono_destinatario(
                    data.get(
                        "telefono_destinatario"
                    )
                ),

                monto_divisa=
                calculo["monto_resultado"]
            )
        )

        db.add(
            detalle
        )

    _guardar_contacto_frecuente(
        db,
        cliente,
        data,
        contacto
    )

    db.add(
        PedidoHistorial(
            pedido_id=pedido.id,
            estado_anterior=None,
            estado_nuevo=pedido.estado,
            usuario=operador.nombre,
            comentario="Pedido creado"
        )
    )

    db.commit()

    db.refresh(
        pedido
    )

    mensaje_data = (
        generar_mensaje_operacion(
            db=db,
            pedido=pedido
        )
    )

    mensaje_pago_cliente = (
        _generar_mensaje_pago_cliente(
            db=db,
            pedido=pedido,
            cliente=cliente,
            metodo_pago=metodo_pago
        )
    )

    mensaje_grupo_pedido = (
        generar_notificacion_grupo_pedido(
            db=db,
            mensaje_operacion=mensaje_data[
                "mensaje"
            ]
        )
    )

    return {

        "pedido_id":
        pedido.id,

        "codigo_operacion":
        pedido.codigo_operacion,

        "estado":
        pedido.estado,

        "servicio":
        pedido.servicio,

        "monto_pago":
        pedido.monto_pago,

        "moneda_pago":
        pedido.moneda_pago,

        "monto_resultado":
        pedido.monto_resultado,

        "tasa_final":
        (
            pedido.monto_pago
            if pedido.servicio == "saldo"
            else pedido.tasa_final
        ),

        "mensaje_operacion":
        mensaje_data[
            "mensaje"
        ],

        "observaciones":
        pedido.observaciones,

        "whatsapp_url":
        mensaje_data[
            "whatsapp_url"
        ],

        "mensaje_pago_cliente":
        mensaje_pago_cliente[
            "mensaje"
        ],

        "whatsapp_pago_url":
        mensaje_pago_cliente[
            "whatsapp_url"
        ],

        "datos_pago":
        mensaje_pago_cliente[
            "datos_pago"
        ],

        "mensaje_grupo_pedidos":
        mensaje_grupo_pedido[
            "mensaje"
        ],

        "whatsapp_grupo_pedidos_url":
        mensaje_grupo_pedido[
            "whatsapp_url"
        ]
    }
