from sqlalchemy.orm import Session

from Backend.models.punto_recogida import (
    PuntoRecogida
)
from Backend.models.provincia_servicio import ProvinciaServicio

from Backend.services.pedido_creator import (
    crear_pedido
)

from Backend.services.monedas import (
    normalizar_moneda
)


def crear_pedido_efectivo(
    db: Session,
    data
):

    moneda_pago = (
        normalizar_moneda(
            data.moneda_pago
        )
    )

    punto_recogida_id = (
        getattr(
            data,
            "punto_recogida_id",
            None
        )
    )

    # Convertir 0 a None para evitar FK error
    if punto_recogida_id == 0:
        punto_recogida_id = None

    if punto_recogida_id:
        punto = (
            db.query(
                PuntoRecogida
            )
            .outerjoin(
                ProvinciaServicio,
                PuntoRecogida.provincia_id == ProvinciaServicio.id
            )
            .filter(
                PuntoRecogida.id
                == punto_recogida_id
            )
            .first()
        )

        if not punto:
            raise Exception(
                "Punto de recogida no encontrado"
            )

        if not punto.activo or not punto.provincia or not punto.provincia.activo:
            raise Exception(
                "Punto de recogida no disponible para servicio"
            )

    payload = {

        "cliente_id":
        (
            getattr(
                data,
                "cliente_id",
                None
            )
            or None
        ),

        "nombre_cliente":
        getattr(
            data,
            "nombre_cliente",
            None
        ),

        "numero_telefono_cliente":
        getattr(
            data,
            "numero_telefono_cliente",
            None
        ),

        "contacto_id":
        getattr(
            data,
            "contacto_id",
            None
        ),

        "operador_id":
        data.operador_id,

        "servicio":
        "efectivo",

        "moneda_pago":
        moneda_pago,

        "monto_pago":
        data.monto_pago,

        "tipo_pago_id":
        data.tipo_pago_id,

        "punto_recogida_id":
        punto_recogida_id,

        "telefono_destinatario":
        getattr(
            data,
            "telefono_destinatario",
            None
        ),

        "documento_identidad_url":
        getattr(
            data,
            "documento_identidad_url",
            None
        ),

        "bonificacion_manual":
        getattr(
            data,
            "bonificacion_manual",
            0
        ),

        "observaciones":
        getattr(
            data,
            "observaciones",
            None
        )
    }

    return crear_pedido(
        db=db,
        data=payload
    )