from sqlalchemy.orm import Session

from models.metodo_pago import MetodoPago


def seed_metodos_pago(db: Session):
    """
    Crea métodos de pago por defecto si no existen.
    """

    metodos_defecto = [
        {
            "nombre": "Pix",
            "moneda": "BRL"
        },
        {
            "nombre": "Brou",
            "moneda": "UYU"
        },
        {
            "nombre": "Itau",
            "moneda": "UYU"
        },
        {
            "nombre": "Efectivo",
            "moneda": "BRL"
        },
        {
            "nombre": "Efectivo",
            "moneda": "UYU"
        },
        {
            "nombre": "Prex",
            "moneda": "UYU"
        },
        {
            "nombre": "MiDinero",
            "moneda": "UYU"
        }
    ]

    for metodo in metodos_defecto:
        existe = (
            db.query(
                MetodoPago
            )
            .filter(
                MetodoPago.nombre
                == metodo["nombre"],
                MetodoPago.moneda
                == metodo["moneda"]
            )
            .first()
        )

        if not existe:
            nuevo_metodo = MetodoPago(
                nombre=metodo["nombre"],
                moneda=metodo["moneda"],
                activo=True
            )
            db.add(nuevo_metodo)

    db.commit()
