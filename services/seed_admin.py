import random
import string

from sqlalchemy.orm import Session

from models.cliente import Cliente


def generar_codigo_referido():

    letras = "".join(
        random.choices(
            string.ascii_uppercase,
            k=4
        )
    )

    numeros = "".join(
        random.choices(
            string.digits,
            k=4
        )
    )

    return f"JH-{letras}{numeros}"


def seed_admin_cliente(
    db: Session
):

    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.email
            ==
            "ronalzambrano34@gmail.com"
        )
        .first()
    )

    if cliente:
        return cliente

    cliente = Cliente(
        nombre=
        "Ronal Zambrano Ferrer",

        email=
        "ronalzambrano34@gmail.com",

        telefono=
        "+5548991233191",

        pais=
        "Brasil",

        moneda_preferida=
        "BRL",

        codigo_referido=
        generar_codigo_referido(),

        perfil_completo=
        True,

        activo=
        True,

        es_admin=
        True
    )

    db.add(
        cliente
    )

    db.commit()

    db.refresh(
        cliente
    )

    print(
        "✅ Admin creado:",
        cliente.email
    )

    return cliente