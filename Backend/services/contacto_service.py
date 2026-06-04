from sqlalchemy import or_
from sqlalchemy.orm import Session

from Backend.models.contacto import Contacto
from Backend.models.cliente import Cliente

from Backend.services.telefonos import (
    detectar_pais_por_codigo_telefono,
    normalizar_telefono,
    obtener_nombre_pais
)


def normalizar_numero_tarjeta(numero: str | None) -> str | None:
    if numero is None or not str(numero).strip():
        return None

    digitos = "".join(ch for ch in str(numero) if ch.isdigit())
    return digitos or None


def _normalizar_datos_contacto(
    telefono: str | None,
    pais: str | None = "br"
):

    if telefono is None or not str(telefono).strip():
        return (
            None,
            obtener_nombre_pais(
                pais or "br"
            )
        )

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
                ),
                Contacto.numero_tarjeta.ilike(
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

    if telefono:
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
        numero_tarjeta=normalizar_numero_tarjeta(data.numero_tarjeta),
        tipo_tarjeta=data.tipo_tarjeta,
        documento_identidad_url=data.documento_identidad_url,
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
        if telefono:
            existe = (
                db.query(
                    Contacto
                )
                .filter(
                    Contacto.cliente_id
                    == contacto.cliente_id,
                    Contacto.telefono
                    == telefono,
                    Contacto.id
                    != contacto.id
                )
                .first()
            )

            if existe:
                raise Exception(
                    "El contacto ya existe"
                )

        cambios["telefono"] = telefono
        cambios["pais"] = pais

    if "numero_tarjeta" in cambios:
        cambios["numero_tarjeta"] = normalizar_numero_tarjeta(
            cambios["numero_tarjeta"]
        )

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
