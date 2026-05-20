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
from services.auth_service import (
    require_permission
)

from services.google_sheet_sync import (
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

    return (
        sync_ofertas(
            db
        )
    )