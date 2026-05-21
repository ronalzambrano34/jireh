from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.auth_service import require_any_permission
from Backend.services.oferta_service import listar_ofertas
from Backend.services.paquete_saldo_service import listar_paquetes_saldo

router = APIRouter(
    prefix="/tasas-operativas",
    tags=["Tasas Operativas"]
)


def _oferta_dict(oferta):
    return {
        "id": oferta.id,
        "servicio": oferta.servicio,
        "nombre": oferta.nombre,
        "tasa": oferta.tasa,
        "minimo_pago": oferta.minimo_pago,
        "moneda_pago": oferta.moneda_pago,
        "origen": oferta.origen,
        "activa": oferta.activa,
    }


def _paquete_dict(paquete):
    return {
        "id": paquete.id,
        "nombre": paquete.nombre,
        "monto_pago": float(paquete.monto_pago),
        "moneda_pago": paquete.moneda_pago,
        "origen": paquete.origen,
        "saldo_cup": paquete.saldo_cup,
        "activo": paquete.activo,
    }


@router.get(
    "/"
)
def obtener_tasas_operativas(
    db: Session = Depends(
        get_db
    ),
    _operador = Depends(
        require_any_permission(
            [
                "pedidos:crear",
                "pedidos:gestionar",
                "empresa:control_total"
            ]
        )
    )
):
    ofertas = listar_ofertas(
        db,
        incluir_inactivas=False,
        limit=300
    )
    paquetes_saldo = listar_paquetes_saldo(
        db,
        incluir_inactivos=False,
        limit=300
    )

    return {
        "generated_at": datetime.utcnow(),
        "ofertas": [
            _oferta_dict(oferta)
            for oferta in ofertas
        ],
        "paquetes_saldo": [
            _paquete_dict(paquete)
            for paquete in paquetes_saldo
        ],
    }
