from datetime import datetime
import random
import string


def generar_codigo_operacion(
    codigo_operador: str,
    servicio: str
):

    meses = {
        1: "A",
        2: "B",
        3: "C",
        4: "D",
        5: "E",
        6: "F",
        7: "G",
        8: "H",
        9: "I",
        10: "J",
        11: "K",
        12: "L"
    }

    servicios = {
        "transferencia": "T1",
        "saldo": "S2",
        "efectivo": "E3",
        "divisa": "D4",
        "otros": "O5"
    }

    hoy = datetime.now()

    anio = str(
        hoy.year
    )[-2:]

    mes = meses[
        hoy.month
    ]

    dia = str(
        hoy.day
    ).zfill(2)

    servicio_codigo = servicios.get(
        servicio,
        "XX"
    )

    random_part = "".join(
        random.choices(
            string.ascii_uppercase
            + string.digits,
            k=3
        )
    )

    codigo = (
        f"JH-"
        f"{codigo_operador}"
        f"{anio}"
        f"{mes}"
        f"{dia}-"
        f"{servicio_codigo}-"
        f"{random_part}"
    )

    return codigo