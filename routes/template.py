from fastapi import (
    APIRouter,
    Depends
)

from sqlalchemy.orm import (
    Session
)

from database import (
    get_db
)

from schemas.template import (
    TemplateUpdate
)

from services.template_service import (
    listar_templates,
    obtener_template,
    actualizar_template
)

router = APIRouter(
    prefix="/templates",
    tags=["Templates"]
)


@router.get("/")
def listar(
    db: Session = Depends(
        get_db
    )
):

    return listar_templates(
        db
    )


@router.get("/{clave}")
def obtener(
    clave: str,
    db: Session = Depends(
        get_db
    )
):

    return obtener_template(
        db,
        clave
    )


@router.put("/{clave}")
def actualizar(
    clave: str,
    data: TemplateUpdate,
    db: Session = Depends(
        get_db
    )
):

    return actualizar_template(
        db,
        clave,
        data.valor
    )