from sqlalchemy.orm import Session

from models.pedido import Pedido
from models.pedido_transferencia import (
    PedidoTransferencia
)
from models.pedido_efectivo import (
    PedidoEfectivo
)
from models.pedido_saldo import (
    PedidoSaldo
)
from models.pedido_divisa import (
    PedidoDivisa
)

from models.operador import (
    Operador
)
from models.cliente import (
    Cliente
)
from models.metodo_pago import (
    MetodoPago
)

from services.calculadora_oferta import (
    calcular_operacion
)

from services.generador_codigo import (
    generar_codigo_operacion
)

from services.mensaje_operacion import (
    generar_mensaje_operacion
)
from services.pedido_estado import (
    PedidoEstado
)

from services.cliente_service import (
    obtener_o_crear_cliente_por_telefono
)
from services.telefonos import (
    normalizar_telefono
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

    return telefono


def crear_pedido(
    db: Session,
    data: dict
):

    if (
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

        tasa = (
            saldo_cup
            / monto_pago
        )

        calculo = {

            "oferta_id":
            None,

            "tasa":
            tasa,

            "bonificacion":
            0,

            "tasa_final":
            tasa,

            "monto_resultado":
            saldo_cup,

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

        monto_divisa = float(
            data["monto_divisa"]
        )

        if monto_pago <= 0:
            raise Exception(
                "El monto_pago debe ser mayor que cero"
            )

        if monto_divisa <= 0:
            raise Exception(
                "El monto_divisa debe ser mayor que cero"
            )

        tasa = (
            monto_divisa
            / monto_pago
        )

        calculo = {

            "oferta_id":
            None,

            "tasa":
            tasa,

            "bonificacion":
            0,

            "tasa_final":
            tasa,

            "monto_resultado":
            monto_divisa,

            "ganancia":
            0
        }

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
    
    # Fallback: usar cliente_id 1 por defecto (admin)
    else:
        cliente = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.id == 1
            )
            .first()
        )

    if not cliente:

        raise Exception(
            "Cliente no encontrado o no pudo ser creado"
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

        detalle = (
            PedidoTransferencia(

                pedido_id=
                pedido.id,

                numero_tarjeta=
                data[
                    "numero_tarjeta"
                ],

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

    # EFECTIVO

    elif (
        data["servicio"]
        ==
        "efectivo"
    ):

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
                ) or None
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

        detalle = (
            PedidoDivisa(
                pedido_id=
                pedido.id,

                tipo_tarjeta=
                data["tipo_tarjeta"],

                numero_tarjeta=
                data["numero_tarjeta"],

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

    return {

        "pedido_id":
        pedido.id,

        "codigo_operacion":
        pedido.codigo_operacion,

        "estado":
        pedido.estado,

        "monto_resultado":
        pedido.monto_resultado,

        "tasa_final":
        pedido.tasa_final,

        "mensaje_operacion":
        mensaje_data[
            "mensaje"
        ],

        "observaciones":
        pedido.observaciones,

        "whatsapp_url":
        mensaje_data[
            "whatsapp_url"
        ]
    }