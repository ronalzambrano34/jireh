from sqlalchemy.orm import (
    Session
)

from models.metodo_pago import (
    MetodoPago
)


def listar_metodos_pago(
    db: Session,
    moneda: str | None = None
):

    query = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.activo
            ==
            True
        )
    )

    if moneda:

        query = (
            query.filter(
                MetodoPago.moneda
                ==
                moneda.upper()
            )
        )

    items = (
        query
        .order_by(
            MetodoPago.nombre
        )
        .all()
    )

    return [
        {
            "id":
            item.id,

            "nombre":
            item.nombre,

            "moneda":
            item.moneda
        }
        for item in items
    ]