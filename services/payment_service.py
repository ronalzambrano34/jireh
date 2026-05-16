from sqlalchemy.orm import (
    Session
)

from services.config_service import (
    obtener_config
)


def obtener_datos_pago(
    db: Session,
    moneda: str,
    tipo_pago: str | None = None
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