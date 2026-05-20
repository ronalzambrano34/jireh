from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.metodo_pago import (
    MetodoPago
)


def _normalizar_moneda(
    moneda: str | None
):

    if moneda is None or not str(moneda).strip():
        raise Exception(
            "La moneda es obligatoria"
        )

    return str(
        moneda
    ).strip().upper()


def listar_metodos_pago(
    db: Session,
    moneda: str | None = None,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0
):

    query = db.query(
        MetodoPago
    )

    if not incluir_inactivos:
        query = query.filter(
            MetodoPago.activo
            == True
        )

    if moneda:
        query = query.filter(
            MetodoPago.moneda
            == _normalizar_moneda(
                moneda
            )
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                MetodoPago.nombre.ilike(
                    patron
                ),
                MetodoPago.moneda.ilike(
                    patron
                )
            )
        )

    limit_seguro = max(
        1,
        min(
            limit,
            200
        )
    )
    offset_seguro = max(
        offset,
        0
    )

    return (
        query
        .order_by(
            MetodoPago.moneda.asc(),
            MetodoPago.nombre.asc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )


def obtener_metodo_pago(
    db: Session,
    metodo_id: int
):

    metodo = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.id
            == metodo_id
        )
        .first()
    )

    if not metodo:
        raise Exception(
            "Metodo de pago no encontrado"
        )

    return metodo


def crear_metodo_pago(
    db: Session,
    data
):

    moneda = _normalizar_moneda(
        data.moneda
    )

    existe = (
        db.query(
            MetodoPago
        )
        .filter(
            MetodoPago.nombre
            == data.nombre,
            MetodoPago.moneda
            == moneda
        )
        .first()
    )

    if existe:
        raise Exception(
            "El metodo de pago ya existe"
        )

    metodo = MetodoPago(
        nombre=data.nombre,
        moneda=moneda
    )

    db.add(
        metodo
    )
    db.commit()
    db.refresh(
        metodo
    )

    return metodo


def actualizar_metodo_pago(
    db: Session,
    metodo_id: int,
    data
):

    metodo = obtener_metodo_pago(
        db,
        metodo_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    if "moneda" in cambios:
        cambios["moneda"] = _normalizar_moneda(
            cambios["moneda"]
        )

    nombre = cambios.get(
        "nombre",
        metodo.nombre
    )
    moneda = cambios.get(
        "moneda",
        metodo.moneda
    )

    if "nombre" in cambios or "moneda" in cambios:
        existe = (
            db.query(
                MetodoPago
            )
            .filter(
                MetodoPago.nombre
                == nombre,
                MetodoPago.moneda
                == moneda,
                MetodoPago.id
                != metodo.id
            )
            .first()
        )

        if existe:
            raise Exception(
                "El metodo de pago ya existe"
            )

    for campo, valor in cambios.items():
        setattr(
            metodo,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        metodo
    )

    return metodo


def eliminar_metodo_pago(
    db: Session,
    metodo_id: int
):

    metodo = obtener_metodo_pago(
        db,
        metodo_id
    )

    metodo.activo = False

    db.commit()
    db.refresh(
        metodo
    )

    return metodo
