import random
import string

from sqlalchemy.orm import Session

from Backend.config import ENABLE_TEST_LOGIN
from Backend.config import OPERADOR_ADMIN_NOMBRE
from Backend.config import OPERADOR_ADMIN_PASSWORD
from Backend.config import OPERADOR_ADMIN_TELEFONO
from Backend.config import TEST_ADMIN_PASSWORD
from Backend.config import TEST_ADMIN_TELEFONO
from Backend.models.cliente import Cliente
from Backend.models.operador import Operador
from Backend.services.auth_service import hash_password
from Backend.services.generador_operador import generar_codigo_operador


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


def seed_cliente_generico(
    db: Session
):
    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.email
            ==
            "cliente.generico@jireh.local"
        )
        .first()
    )

    if not cliente:
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

    if not cliente:
        cliente = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.id == 1
            )
            .first()
        )

    if cliente:
        cliente.nombre = "Cliente Generico"
        cliente.email = "cliente.generico@jireh.local"
        cliente.telefono = None
        cliente.pais = "Brasil"
        cliente.moneda_preferida = "BRL"
        cliente.perfil_completo = True
        cliente.activo = True
    else:
        cliente = Cliente(
            nombre="Cliente Generico",
            email="cliente.generico@jireh.local",
            telefono=None,
            pais="Brasil",
            moneda_preferida="BRL",
            codigo_referido=generar_codigo_referido(),
            perfil_completo=True,
            activo=True
        )
        db.add(
            cliente
        )

    db.commit()
    db.refresh(
        cliente
    )

    return cliente


def seed_admin_operador(
    db: Session
):
    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            ==
            OPERADOR_ADMIN_TELEFONO
        )
        .first()
    )

    if not operador:
        operador = Operador(
            nombre=OPERADOR_ADMIN_NOMBRE,
            telefono=OPERADOR_ADMIN_TELEFONO,
            codigo_operador=generar_codigo_operador(
                OPERADOR_ADMIN_NOMBRE
            ),
            rol="admin",
            activo=True
        )
        db.add(
            operador
        )
    else:
        operador.nombre = OPERADOR_ADMIN_NOMBRE
        operador.rol = "admin"
        operador.activo = True

    if OPERADOR_ADMIN_PASSWORD and not operador.password_hash:
        operador.password_hash = hash_password(
            OPERADOR_ADMIN_PASSWORD
        )

    db.commit()
    db.refresh(
        operador
    )

    return operador


def seed_test_admin_operador(
    db: Session
):
    if not ENABLE_TEST_LOGIN:
        return None

    operador = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            ==
            TEST_ADMIN_TELEFONO
        )
        .first()
    )

    if not operador:
        operador = Operador(
            nombre="Admin Prueba",
            telefono=TEST_ADMIN_TELEFONO,
            codigo_operador=generar_codigo_operador(
                "Admin Prueba"
            ),
            rol="admin",
            activo=True
        )
        db.add(
            operador
        )
    else:
        operador.nombre = "Admin Prueba"
        operador.rol = "admin"
        operador.activo = True

    operador.password_hash = hash_password(
        TEST_ADMIN_PASSWORD,
        min_length=1
    )

    db.commit()
    db.refresh(
        operador
    )

    return operador
