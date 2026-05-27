from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from google.auth.exceptions import (
    RefreshError
)

from sqlalchemy.orm import (
    Session
)

from Backend.database import (
    get_db
)
from Backend.services.auth_service import (
    require_any_permission
)

from Backend.services.oferta_sync_control import (
    sincronizar_ofertas_cacheadas
)

router = APIRouter(
    prefix="/sync",
    tags=["Sync"],
    dependencies=[
        Depends(
            require_any_permission(
                [
                    "pedidos:crear",
                    "pedidos:gestionar",
                    "empresa:control_total"
                ]
            )
        )
    ]
)


@router.post(
    "/ofertas"
)
def sincronizar(
    db: Session = Depends(
        get_db
    )
):

    try:
        return (
            sincronizar_ofertas_cacheadas(
                db,
                force=True
            )
        )
    except HTTPException:
        raise
    except RefreshError as exc:
        db.rollback()
        mensaje = str(exc)
        if "Invalid JWT Signature" in mensaje:
            mensaje = (
                "Google rechazo la firma de Backend/credentials.json. "
                "Genera una clave JSON nueva para la service account, reemplaza ese archivo "
                "y comparte la hoja con el client_email del JSON."
            )
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron sincronizar las ofertas desde Google Sheets. "
                f"Detalle tecnico: RefreshError: {mensaje}"
            )
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron sincronizar las ofertas desde Google Sheets. "
                f"Detalle tecnico: {type(exc).__name__}: {exc}"
            )
        ) from exc
