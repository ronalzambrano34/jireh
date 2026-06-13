from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from Backend.database import get_db
from Backend.services.oferta_service import listar_ofertas
from Backend.services.paquete_saldo_service import listar_paquetes_saldo
from Backend.services.promocion_service import listar_promociones_vigentes
from Backend.services.oferta_sync_control import obtener_estado_sync_ofertas

router = APIRouter(
    prefix="/tasas-operativas",
    tags=["Tasas Operativas"]
)


SERVICIOS_OFERTAS_DASHBOARD = {"transferencia", "efectivo"}
SERVICIOS_DIVISA_DASHBOARD = {"mlc", "usd", "clasica"}


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


def _origen_prioridad(item):
    origen = (getattr(item, "origen", "manual") or "manual").strip().lower()
    return 0 if origen != "google_sheet" else 1


def _key_float(value, precision=4):
    return round(float(value or 0), precision)


def _preferir_item(candidato, actual):
    prioridad_candidato = _origen_prioridad(candidato)
    prioridad_actual = _origen_prioridad(actual)
    if prioridad_candidato != prioridad_actual:
        return prioridad_candidato < prioridad_actual
    return (getattr(candidato, "id", 0) or 0) > (getattr(actual, "id", 0) or 0)


def _deduplicar_ofertas(ofertas):
    seleccionadas = {}
    orden = []

    for oferta in ofertas:
        key = (
            oferta.servicio,
            (oferta.moneda_pago or "BRL").upper(),
            _key_float(oferta.minimo_pago),
        )
        if key not in seleccionadas:
            seleccionadas[key] = oferta
            orden.append(key)
            continue

        if _preferir_item(oferta, seleccionadas[key]):
            seleccionadas[key] = oferta

    return [
        seleccionadas[key]
        for key in orden
    ]


def _deduplicar_paquetes(paquetes):
    seleccionados = {}
    orden = []

    for paquete in paquetes:
        key = (
            (paquete.moneda_pago or "BRL").upper(),
            _key_float(paquete.monto_pago, precision=2),
        )
        if key not in seleccionados:
            seleccionados[key] = paquete
            orden.append(key)
            continue

        if _preferir_item(paquete, seleccionados[key]):
            seleccionados[key] = paquete

    return [
        seleccionados[key]
        for key in orden
    ]


def _promocion_dict(promocion):
    return {
        "id": promocion.id,
        "imagen_url": promocion.imagen_url,
        "descripcion": promocion.descripcion,
        "fecha_desde": promocion.fecha_desde,
        "fecha_hasta": promocion.fecha_hasta,
        "activa": promocion.activa,
        "vigente": promocion.vigente,
        "created_at": promocion.created_at,
        "updated_at": promocion.updated_at,
    }


@router.get(
    "/"
)
def obtener_tasas_operativas(
    db: Session = Depends(
        get_db
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
    promociones = listar_promociones_vigentes(
        db,
        limit=20
    )

    ofertas = _deduplicar_ofertas(
        ofertas
    )
    paquetes_saldo = _deduplicar_paquetes(
        paquetes_saldo
    )

    ofertas_dashboard = [
        oferta
        for oferta in ofertas
        if oferta.servicio in SERVICIOS_OFERTAS_DASHBOARD
    ]
    ofertas_divisa = [
        oferta
        for oferta in ofertas
        if oferta.servicio in SERVICIOS_DIVISA_DASHBOARD
    ]

    return {
        "generated_at": datetime.utcnow(),
        "ofertas": [
            _oferta_dict(oferta)
            for oferta in ofertas_dashboard
        ],
        "ofertas_divisa": [
            _oferta_dict(oferta)
            for oferta in ofertas_divisa
        ],
        "paquetes_saldo": [
            _paquete_dict(paquete)
            for paquete in paquetes_saldo
        ],
        "promociones": [
            _promocion_dict(promocion)
            for promocion in promociones
        ],
        "sync": obtener_estado_sync_ofertas(
            db
        ),
    }
