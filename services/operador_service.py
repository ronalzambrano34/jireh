from sqlalchemy.orm import Session

from models.operador import (
    Operador
)

from services.generador_operador import (
    generar_codigo_operador
)


def crear_operador(
    db: Session,
    data
):

    existe = (
        db.query(
            Operador
        )
        .filter(
            Operador.telefono
            == data.telefono
        )
        .first()
    )

    if existe:

        raise Exception(
            "El operador ya existe"
        )

    codigo = None

    while True:

        codigo_temp = (
            generar_codigo_operador(
                data.nombre
            )
        )

        existe_codigo = (
            db.query(
                Operador
            )
            .filter(
                Operador.codigo_operador
                == codigo_temp
            )
            .first()
        )

        if not existe_codigo:

            codigo = (
                codigo_temp
            )

            break

    operador = Operador(

        nombre=data.nombre,

        telefono=data.telefono,

        codigo_operador=codigo
    )

    db.add(
        operador
    )

    db.commit()

    db.refresh(
        operador
    )

    return {

        "message":
        "Operador creado",

        "codigo_operador":
        operador.codigo_operador
    }