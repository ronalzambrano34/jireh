from sqlalchemy.orm import Session

from Backend.models.paquete_saldo import PaqueteSaldo


def listar_paquetes_saldo(
    db: Session,
    moneda_pago: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 100,
    offset: int = 0
):
    query = db.query(
        PaqueteSaldo
    )

    if moneda_pago:
        query = query.filter(
            PaqueteSaldo.moneda_pago == moneda_pago.strip().upper()
        )

    if not incluir_inactivos:
        query = query.filter(
            PaqueteSaldo.activo == True
        )

    return (
        query
        .order_by(
            PaqueteSaldo.moneda_pago.asc(),
            PaqueteSaldo.monto_pago.asc(),
            PaqueteSaldo.id.desc()
        )
        .offset(
            max(offset, 0)
        )
        .limit(
            max(1, min(limit, 300))
        )
        .all()
    )


def obtener_paquete_saldo(
    db: Session,
    paquete_id: int
):
    paquete = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.id == paquete_id
        )
        .first()
    )

    if not paquete:
        raise Exception(
            "Paquete saldo no encontrado"
        )

    return paquete


def crear_paquete_saldo(
    db: Session,
    data
):
    paquete = PaqueteSaldo(
        nombre=data.nombre,
        monto_pago=data.monto_pago,
        moneda_pago=data.moneda_pago.strip().upper(),
        origen=data.origen,
        saldo_cup=data.saldo_cup,
        activo=data.activo
    )
    db.add(
        paquete
    )
    db.commit()
    db.refresh(
        paquete
    )
    return paquete


def actualizar_paquete_saldo(
    db: Session,
    paquete_id: int,
    data
):
    paquete = obtener_paquete_saldo(
        db,
        paquete_id
    )
    cambios = data.model_dump(
        exclude_unset=True
    )

    if "moneda_pago" in cambios and cambios["moneda_pago"]:
        cambios["moneda_pago"] = cambios["moneda_pago"].strip().upper()

    for campo, valor in cambios.items():
        setattr(
            paquete,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        paquete
    )
    return paquete


def eliminar_paquete_saldo(
    db: Session,
    paquete_id: int
):
    paquete = obtener_paquete_saldo(
        db,
        paquete_id
    )
    paquete.activo = False
    db.commit()
    db.refresh(
        paquete
    )
    return paquete
