from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from google.auth.exceptions import (
    RefreshError
)
from gspread.exceptions import (
    SpreadsheetNotFound
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
from Backend.services.google_sheet_sync import (
    credentials_client_email,
    sheet_id_configurado
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
    except SpreadsheetNotFound as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron sincronizar las ofertas desde Google Sheets. "
                "Google no encontro la hoja configurada. Revisa que GOOGLE_SHEET_ID "
                "sea el ID o link completo correcto, y que la hoja este compartida con "
                f"{credentials_client_email() or 'el client_email de Backend/credentials.json'}. "
                f"Sheet usado: {sheet_id_configurado()}. "
                f"Detalle tecnico: SpreadsheetNotFound: {exc}"
            )
        ) from exc
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudieron sincronizar las ofertas desde Google Sheets. "
                "Google rechazo el acceso a la hoja configurada. Comparte el archivo "
                f"con {credentials_client_email() or 'el client_email de Backend/credentials.json'} "
                "como lector o editor, y confirma que GOOGLE_SHEET_ID apunte a esa misma hoja. "
                f"Sheet usado: {sheet_id_configurado()}. "
                f"Detalle tecnico: PermissionError: {exc}"
            )
        ) from exc
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
