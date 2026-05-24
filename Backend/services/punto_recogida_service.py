from sqlalchemy import or_
from sqlalchemy.orm import Session

from Backend.models.punto_recogida import PuntoRecogida


def listar_puntos_recogida(
    db: Session,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0
):

    query = db.query(
        PuntoRecogida
    )

    if not incluir_inactivos:
        query = query.filter(
            PuntoRecogida.activo
            == True
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                PuntoRecogida.nombre.ilike(
                    patron
                ),
                PuntoRecogida.direccion.ilike(
                    patron
                ),
                PuntoRecogida.telefono.ilike(
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
            PuntoRecogida.nombre.asc(),
            PuntoRecogida.id.asc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )


def obtener_punto_recogida(
    db: Session,
    punto_id: int
):

    punto = (
        db.query(
            PuntoRecogida
        )
        .filter(
            PuntoRecogida.id
            == punto_id
        )
        .first()
    )

    if not punto:
        raise Exception(
            "Punto de recogida no encontrado"
        )

    return punto


def crear_punto_recogida(
    db: Session,
    data
):

    existe = (
        db.query(
            PuntoRecogida
        )
        .filter(
            PuntoRecogida.nombre
            == data.nombre,
            PuntoRecogida.direccion
            == data.direccion
        )
        .first()
    )

    if existe:
        raise Exception(
            "El punto de recogida ya existe"
        )

    punto = PuntoRecogida(
        nombre=data.nombre,
        direccion=data.direccion,
        telefono=data.telefono
    )

    db.add(
        punto
    )
    db.commit()
    db.refresh(
        punto
    )

    return punto


def actualizar_punto_recogida(
    db: Session,
    punto_id: int,
    data
):

    punto = obtener_punto_recogida(
        db,
        punto_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    nombre = cambios.get(
        "nombre",
        punto.nombre
    )
    direccion = cambios.get(
        "direccion",
        punto.direccion
    )

    if "nombre" in cambios or "direccion" in cambios:
        existe = (
            db.query(
                PuntoRecogida
            )
            .filter(
                PuntoRecogida.nombre
                == nombre,
                PuntoRecogida.direccion
                == direccion,
                PuntoRecogida.id
                != punto.id
            )
            .first()
        )

        if existe:
            raise Exception(
                "El punto de recogida ya existe"
            )

    for campo, valor in cambios.items():
        setattr(
            punto,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        punto
    )

    return punto


def eliminar_punto_recogida(
    db: Session,
    punto_id: int
):

    punto = obtener_punto_recogida(
        db,
        punto_id
    )

    punto.activo = False

    db.commit()
    db.refresh(
        punto
    )

    return punto
