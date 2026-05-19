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
            "nombre": "Efectivo (BRL)",
            "moneda": "BRL"
        },
        {
            "nombre": "Efectivo (UYU)",
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
            try:
                nuevo_metodo = MetodoPago(
                    nombre=metodo["nombre"],
                    moneda=metodo["moneda"],
                    activo=True
                )
                db.add(nuevo_metodo)
                db.commit()
            except Exception as e:
                db.rollback()
                print(
                    f"Error al crear método {metodo['nombre']} {metodo['moneda']}: {str(e)}"
                )
