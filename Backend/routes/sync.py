from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import (
    Session
)

from Backend.database import (
    get_db
)
from Backend.services.auth_service import (
    require_permission
)

from Backend.services.google_sheet_sync import (
    sync_ofertas
)

router = APIRouter(
    prefix="/sync",
    tags=["Sync"],
    dependencies=[
        Depends(
            require_permission(
                "empresa:control_total"
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
            sync_ofertas(
                db
            )
        )
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron sincronizar las ofertas desde Google Sheets. "
                f"Detalle tecnico: {type(exc).__name__}: {exc}"
            )
        ) from exc
