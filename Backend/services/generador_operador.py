import random
import string


def generar_codigo_operador(
    nombre: str
):

    primera = (
        nombre[0]
        .upper()
    )

    segunda = random.choice(
        string.ascii_uppercase
    )

    tercera = random.choice(
        string.digits
    )

    cuarta = random.choice(
        string.ascii_uppercase
    )

    codigo = (
        f"J"
        f"{primera}"
        f"{segunda}"
        f"{tercera}"
        f"{cuarta}"
    )

    return codigo