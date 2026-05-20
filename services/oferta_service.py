from sqlalchemy.orm import Session

from models.oferta import Oferta


def listar_ofertas(
    db: Session,
    servicio: str | None = None,
    moneda_pago: str | None = None,
    incluir_inactivas: bool = False,
    limit: int = 100,
    offset: int = 0
):
    query = db.query(
        Oferta
    )

    if servicio:
        query = query.filter(
            Oferta.servicio == servicio.strip().lower()
        )

    if moneda_pago:
        query = query.filter(
            Oferta.moneda_pago == moneda_pago.strip().upper()
        )

    if not incluir_inactivas:
        query = query.filter(
            Oferta.activa == True
        )

    return (
        query
        .order_by(
            Oferta.servicio.asc(),
            Oferta.moneda_pago.asc(),
            Oferta.minimo_pago.desc(),
            Oferta.id.desc()
        )
        .offset(
            max(offset, 0)
        )
        .limit(
            max(1, min(limit, 300))
        )
        .all()
    )


def obtener_oferta(
    db: Session,
    oferta_id: int
):
    oferta = (
        db.query(
            Oferta
        )
        .filter(
            Oferta.id == oferta_id
        )
        .first()
    )

    if not oferta:
        raise Exception(
            "Oferta no encontrada"
        )

    return oferta


def crear_oferta(
    db: Session,
    data
):
    oferta = Oferta(
        servicio=data.servicio.strip().lower(),
        nombre=data.nombre,
        tasa=data.tasa,
        minimo_pago=data.minimo_pago,
        moneda_pago=data.moneda_pago.strip().upper(),
        origen=data.origen,
        activa=data.activa
    )
    db.add(
        oferta
    )
    db.commit()
    db.refresh(
        oferta
    )
    return oferta


def actualizar_oferta(
    db: Session,
    oferta_id: int,
    data
):
    oferta = obtener_oferta(
        db,
        oferta_id
    )
    cambios = data.model_dump(
        exclude_unset=True
    )

    if "servicio" in cambios and cambios["servicio"]:
        cambios["servicio"] = cambios["servicio"].strip().lower()

    if "moneda_pago" in cambios and cambios["moneda_pago"]:
        cambios["moneda_pago"] = cambios["moneda_pago"].strip().upper()

    for campo, valor in cambios.items():
        setattr(
            oferta,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        oferta
    )
    return oferta


def eliminar_oferta(
    db: Session,
    oferta_id: int
):
    oferta = obtener_oferta(
        db,
        oferta_id
    )
    oferta.activa = False
    db.commit()
    db.refresh(
        oferta
    )
    return oferta
