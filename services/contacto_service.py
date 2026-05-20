from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.contacto import Contacto
from models.cliente import Cliente

from services.telefonos import (
    detectar_pais_por_codigo_telefono,
    normalizar_telefono,
    obtener_nombre_pais
)


def _normalizar_datos_contacto(
    telefono: str,
    pais: str | None = "br"
):

    telefono_normalizado = normalizar_telefono(
        telefono,
        pais or "br"
    )
    pais_detectado = detectar_pais_por_codigo_telefono(
        telefono_normalizado
    )

    return (
        telefono_normalizado,
        obtener_nombre_pais(
            pais_detectado
        )
    )


def listar_contactos(
    db: Session,
    cliente_id: int | None = None,
    busqueda: str | None = None,
    incluir_inactivos: bool = False
):

    query = db.query(
        Contacto
    )

    if cliente_id is not None:
        query = query.filter(
            Contacto.cliente_id
            == cliente_id
        )

    if not incluir_inactivos:
        query = query.filter(
            Contacto.activo
            == True
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Contacto.nombre.ilike(
                    patron
                ),
                Contacto.telefono.ilike(
                    patron
                )
            )
        )

    return (
        query
        .order_by(
            Contacto.nombre.asc()
        )
        .all()
    )


def obtener_contacto(
    db: Session,
    contacto_id: int
):

    contacto = (
        db.query(
            Contacto
        )
        .filter(
            Contacto.id
            == contacto_id
        )
        .first()
    )

    if not contacto:
        raise Exception(
            "Contacto no encontrado"
        )

    return contacto


def crear_contacto(
    db: Session,
    data
):

    if data.cliente_id is not None:
        cliente = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.id
                == data.cliente_id
            )
            .first()
        )

        if not cliente:
            raise Exception(
                "Cliente no encontrado"
            )

    telefono, pais = _normalizar_datos_contacto(
        data.telefono,
        data.pais
    )

    existe = (
        db.query(
            Contacto
        )
        .filter(
            Contacto.cliente_id
            == data.cliente_id,
            Contacto.telefono
            == telefono
        )
        .first()
    )

    if existe:
        raise Exception(
            "El contacto ya existe"
        )

    contacto = Contacto(
        cliente_id=data.cliente_id,
        nombre=data.nombre,
        telefono=telefono,
        pais=pais,
        notas=data.notas
    )

    db.add(
        contacto
    )
    db.commit()
    db.refresh(
        contacto
    )

    return contacto


def actualizar_contacto(
    db: Session,
    contacto_id: int,
    data
):

    contacto = obtener_contacto(
        db,
        contacto_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    if "telefono" in cambios:
        telefono, pais = _normalizar_datos_contacto(
            cambios["telefono"],
            cambios.get(
                "pais",
                contacto.pais
            )
        )
        cambios["telefono"] = telefono
        cambios["pais"] = pais

    for campo, valor in cambios.items():
        setattr(
            contacto,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        contacto
    )

    return contacto


def eliminar_contacto(
    db: Session,
    contacto_id: int
):

    contacto = obtener_contacto(
        db,
        contacto_id
    )
    contacto.activo = False

    db.commit()
    db.refresh(
        contacto
    )

    return contacto
