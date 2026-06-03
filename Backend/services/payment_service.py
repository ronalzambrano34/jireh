from sqlalchemy.orm import (
    Session
)

from Backend.services.config_service import (
    obtener_config
)
from Backend.models.metodo_pago import MetodoPago
from Backend.services.metodo_pago_service import (
    obtener_cuenta_predeterminada_metodo_pago
)


def obtener_datos_pago(
    db: Session,
    moneda: str,
    tipo_pago: str | None = None,
    metodo_pago: MetodoPago | None = None
):

    moneda = (
        moneda
        .strip()
        .upper()
    )

    tipo_pago = (
        tipo_pago
        or ""
    ).strip().lower()


    if metodo_pago is not None:
        cuenta_predeterminada = obtener_cuenta_predeterminada_metodo_pago(
            db,
            metodo_pago.id
        )
        if cuenta_predeterminada:
            return {
                "metodo_pago": metodo_pago.nombre,
                "cuenta_pago": cuenta_predeterminada.cuenta,
                "titular_pago": cuenta_predeterminada.titular,
                "qr_pago_url": cuenta_predeterminada.qr_url
            }

    # ---------- BRASIL ----------

    if moneda == "BRL":

        return {
            "metodo_pago":
            "PIX",

            "cuenta_pago":
            obtener_config(
                db,
                "brl_pix_cuenta"
            ),

            "titular_pago":
            obtener_config(
                db,
                "brl_pix_titular"
            )
        }

    # ---------- URUGUAY ----------

    elif moneda == "UYU":

        bancos = {
            "itau":
            {
                "metodo_pago":
                "ITAÚ",

                "cuenta_pago":
                obtener_config(
                    db,
                    "uy_itau_cuenta"
                ),

                "titular_pago":
                obtener_config(
                    db,
                    "uy_itau_titular"
                )
            },

            "brou":
            {
                "metodo_pago":
                "BROU",

                "cuenta_pago":
                obtener_config(
                    db,
                    "uy_brou_cuenta"
                ),

                "titular_pago":
                obtener_config(
                    db,
                    "uy_brou_titular"
                )
            },

            "prex":
            {
                "metodo_pago":
                "PREX",

                "cuenta_pago":
                obtener_config(
                    db,
                    "uy_prex_cuenta"
                ),

                "titular_pago":
                obtener_config(
                    db,
                    "uy_prex_titular"
                )
            },

            "midinero":
            {
                "metodo_pago":
                "MiDinero",

                "cuenta_pago":
                obtener_config(
                    db,
                    "uy_midinero_cuenta"
                ),

                "titular_pago":
                obtener_config(
                    db,
                    "uy_midinero_titular"
                )
            }
        }

        if tipo_pago not in bancos:
            raise Exception(
                "Banco UYU no soportado"
            )

        return bancos[
            tipo_pago
        ]

    raise Exception(
        f"Moneda no soportada: {moneda}"
    )