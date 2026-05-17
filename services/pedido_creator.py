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

from models.operador import (
    Operador
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
        data[
            "cliente_id"
        ],

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

                telefono_opcional=
                data.get(
                    "telefono_opcional"
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

                punto_recogida_id=
                data.get(
                    "punto_recogida_id"
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

                numero_telefono=
                data[
                    "numero_telefono"
                ],

                saldo_cup=
                calculo[
                    "monto_resultado"
                ]
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

        "whatsapp_url":
        mensaje_data[
            "whatsapp_url"
        ]
    }