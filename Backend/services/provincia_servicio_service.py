from sqlalchemy.orm import Session

from Backend.models.provincia_servicio import ProvinciaServicio
from Backend.models.punto_recogida import PuntoRecogida

PROVINCIAS_INICIALES = (
    ("Santiago de Cuba", True),
    ("La Habana", True),
    ("Las Tunas", True),
)


def provincia_servicio_dict(provincia: ProvinciaServicio):
    return {
        "id": provincia.id,
        "nombre": provincia.nombre,
        "activo": provincia.activo,
    }


def seed_provincias_servicio(db: Session):
    for nombre, activo in PROVINCIAS_INICIALES:
        provincia = (
            db.query(ProvinciaServicio)
            .filter(ProvinciaServicio.nombre == nombre)
            .first()
        )
        if not provincia:
            db.add(
                ProvinciaServicio(
                    nombre=nombre,
                    activo=activo
                )
            )
    db.commit()

    santiago = (
        db.query(ProvinciaServicio)
        .filter(ProvinciaServicio.nombre == "Santiago de Cuba")
        .first()
    )
    if santiago:
        (
            db.query(PuntoRecogida)
            .filter(PuntoRecogida.provincia_id.is_(None))
            .update({PuntoRecogida.provincia_id: santiago.id})
        )
        db.commit()


def listar_provincias_servicio(db: Session, incluir_inactivas: bool = True):
    query = db.query(ProvinciaServicio)
    if not incluir_inactivas:
        query = query.filter(ProvinciaServicio.activo == True)

    return (
        query
        .order_by(ProvinciaServicio.nombre.asc(), ProvinciaServicio.id.asc())
        .all()
    )


def obtener_provincia_servicio(db: Session, provincia_id: int):
    provincia = (
        db.query(ProvinciaServicio)
        .filter(ProvinciaServicio.id == provincia_id)
        .first()
    )
    if not provincia:
        raise Exception("Provincia de servicio no encontrada")
    return provincia


def crear_provincia_servicio(db: Session, data):
    nombre = data.nombre.strip()
    if not nombre:
        raise Exception("El nombre de la provincia es obligatorio")

    existe = (
        db.query(ProvinciaServicio)
        .filter(ProvinciaServicio.nombre == nombre)
        .first()
    )
    if existe:
        raise Exception("La provincia ya existe")

    provincia = ProvinciaServicio(
        nombre=nombre,
        activo=data.activo
    )
    db.add(provincia)
    db.commit()
    db.refresh(provincia)
    return provincia


def actualizar_provincia_servicio(db: Session, provincia_id: int, data):
    provincia = obtener_provincia_servicio(db, provincia_id)
    cambios = data.model_dump(exclude_unset=True)

    if "nombre" in cambios:
        nombre = (cambios.get("nombre") or "").strip()
        if not nombre:
            raise Exception("El nombre de la provincia es obligatorio")
        existe = (
            db.query(ProvinciaServicio)
            .filter(
                ProvinciaServicio.nombre == nombre,
                ProvinciaServicio.id != provincia.id
            )
            .first()
        )
        if existe:
            raise Exception("La provincia ya existe")
        provincia.nombre = nombre

    if "activo" in cambios:
        provincia.activo = cambios["activo"]

    db.commit()
    db.refresh(provincia)
    return provincia
