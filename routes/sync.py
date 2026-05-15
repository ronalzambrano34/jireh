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

from services.google_sheet_sync import (
    sync_ofertas
)

router = APIRouter(
    prefix="/sync",
    tags=["Sync"]
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