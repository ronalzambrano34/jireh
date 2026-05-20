from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.cliente import Cliente
from models.pedido import Pedido

from services.contacto_service import listar_contactos
from services.pedido_service import pedido_dict
from services.telefonos import (
    normalizar_telefono,
    obtener_nombre_pais,
    detectar_pais_por_codigo_telefono
)


def _normalizar_telefono_cliente(
    telefono: str | None,
    pais: str | None = "br"
):
    if telefono is None or not str(telefono).strip():
        return None

    return normalizar_telefono(
        telefono,
        pais or "br"
    )


def _aplicar_pais_por_telefono(
    telefono: str | None,
    pais: str | None
):
    if not telefono:
        return pais

    pais_detectado = detectar_pais_por_codigo_telefono(
        telefono
    )

    return obtener_nombre_pais(
        pais_detectado
    )


def obtener_o_crear_cliente_por_telefono(
    db: Session,
    numero_telefono: str,
    nombre: str = None,
    pais: str = "br"
):
    """
    Busca un cliente por número de teléfono.
    Si no existe, crea uno nuevo.
    """

    telefono_normalizado = normalizar_telefono(
        numero_telefono,
        pais
    )

    pais_detectado = detectar_pais_por_codigo_telefono(
        telefono_normalizado
    )

    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.telefono
            == telefono_normalizado
        )
        .first()
    )

    if cliente:
        return cliente

    nuevo_cliente = Cliente(
        nombre=(
            nombre
            or f"Cliente {telefono_normalizado}"
        ),
        telefono=telefono_normalizado,
        pais=obtener_nombre_pais(
            pais_detectado
        )
    )

    db.add(
        nuevo_cliente
    )
    db.commit()
    db.refresh(
        nuevo_cliente
    )

    return nuevo_cliente


def listar_clientes(
    db: Session,
    busqueda: str | None = None,
    incluir_inactivos: bool = False,
    limit: int = 50,
    offset: int = 0
):
    query = db.query(
        Cliente
    )

    if not incluir_inactivos:
        query = query.filter(
            Cliente.activo
            == True
        )

    if busqueda:
        patron = f"%{busqueda}%"
        query = query.filter(
            or_(
                Cliente.nombre.ilike(
                    patron
                ),
                Cliente.email.ilike(
                    patron
                ),
                Cliente.telefono.ilike(
                    patron
                ),
                Cliente.codigo_referido.ilike(
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
            Cliente.created_at.desc(),
            Cliente.id.desc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )


def obtener_cliente(
    db: Session,
    cliente_id: int
):
    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.id
            == cliente_id
        )
        .first()
    )

    if not cliente:
        raise Exception(
            "Cliente no encontrado"
        )

    return cliente


def buscar_cliente_por_telefono(
    db: Session,
    telefono: str,
    pais: str | None = "br"
):
    telefono_normalizado = _normalizar_telefono_cliente(
        telefono,
        pais
    )

    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.telefono
            == telefono_normalizado
        )
        .first()
    )

    if not cliente:
        raise Exception(
            "Cliente no encontrado"
        )

    return cliente


def crear_cliente(
    db: Session,
    data
):
    telefono = _normalizar_telefono_cliente(
        data.telefono,
        data.pais
    )

    if telefono:
        existe = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.telefono
                == telefono
            )
            .first()
        )

        if existe:
            raise Exception(
                "El cliente ya existe"
            )

    if data.email:
        existe_email = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.email
                == data.email
            )
            .first()
        )

        if existe_email:
            raise Exception(
                "El email ya esta registrado"
            )

    if data.referido_por_id is not None:
        obtener_cliente(
            db,
            data.referido_por_id
        )

    cliente = Cliente(
        nombre=data.nombre,
        email=data.email,
        telefono=telefono,
        pais=_aplicar_pais_por_telefono(
            telefono,
            data.pais
        ),
        moneda_preferida=data.moneda_preferida,
        referido_por_id=data.referido_por_id,
        perfil_completo=bool(
            data.email
            and telefono
        )
    )

    db.add(
        cliente
    )
    db.commit()
    db.refresh(
        cliente
    )

    return cliente


def actualizar_cliente(
    db: Session,
    cliente_id: int,
    data
):
    cliente = obtener_cliente(
        db,
        cliente_id
    )

    cambios = data.model_dump(
        exclude_unset=True
    )

    if "telefono" in cambios:
        telefono = _normalizar_telefono_cliente(
            cambios["telefono"],
            cambios.get(
                "pais",
                cliente.pais
            )
        )

        if telefono:
            existe = (
                db.query(
                    Cliente
                )
                .filter(
                    Cliente.telefono
                    == telefono,
                    Cliente.id
                    != cliente.id
                )
                .first()
            )

            if existe:
                raise Exception(
                    "El cliente ya existe"
                )

        cambios["telefono"] = telefono
        cambios["pais"] = _aplicar_pais_por_telefono(
            telefono,
            cambios.get(
                "pais",
                cliente.pais
            )
        )

    if "email" in cambios and cambios["email"]:
        existe_email = (
            db.query(
                Cliente
            )
            .filter(
                Cliente.email
                == cambios["email"],
                Cliente.id
                != cliente.id
            )
            .first()
        )

        if existe_email:
            raise Exception(
                "El email ya esta registrado"
            )

    if cambios.get(
        "referido_por_id"
    ) is not None:
        if cambios["referido_por_id"] == cliente.id:
            raise Exception(
                "Un cliente no puede referirse a si mismo"
            )

        obtener_cliente(
            db,
            cambios["referido_por_id"]
        )

    for campo, valor in cambios.items():
        setattr(
            cliente,
            campo,
            valor
        )

    db.commit()
    db.refresh(
        cliente
    )

    return cliente


def eliminar_cliente(
    db: Session,
    cliente_id: int
):
    cliente = obtener_cliente(
        db,
        cliente_id
    )

    cliente.activo = False

    db.commit()
    db.refresh(
        cliente
    )

    return cliente


def listar_contactos_cliente(
    db: Session,
    cliente_id: int,
    busqueda: str | None = None,
    incluir_inactivos: bool = False
):
    obtener_cliente(
        db,
        cliente_id
    )

    return listar_contactos(
        db,
        cliente_id=cliente_id,
        busqueda=busqueda,
        incluir_inactivos=incluir_inactivos
    )


def listar_pedidos_cliente(
    db: Session,
    cliente_id: int,
    limit: int = 50,
    offset: int = 0,
    incluir_detalle: bool = False
):
    obtener_cliente(
        db,
        cliente_id
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

    pedidos = (
        db.query(
            Pedido
        )
        .filter(
            Pedido.cliente_id
            == cliente_id
        )
        .order_by(
            Pedido.created_at.desc(),
            Pedido.id.desc()
        )
        .offset(
            offset_seguro
        )
        .limit(
            limit_seguro
        )
        .all()
    )

    return [
        pedido_dict(
            db,
            pedido,
            incluir_detalle=incluir_detalle
        )
        for pedido in pedidos
    ]
