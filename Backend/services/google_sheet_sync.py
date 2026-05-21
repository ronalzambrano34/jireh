from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from datetime import datetime
from pathlib import Path
import re
import unicodedata

import gspread

from sqlalchemy.orm import Session

from Backend.models.oferta import Oferta
from Backend.models.paquete_saldo import PaqueteSaldo
from Backend.services.db_maintenance import ensure_runtime_columns
from Backend.services.monedas import normalizar_moneda


SHEET_ID = "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"
ORIGEN_GOOGLE_SHEET = "google_sheet"
CREDENTIALS_FILE = Path(__file__).resolve().parents[1] / "credentials.json"
SERVICIOS_OFERTAS = {"transferencia", "efectivo", "mlc", "usd", "clasica"}
NOMBRES_SERVICIO = {
    "transferencia": "Transferencia",
    "efectivo": "Efectivo",
    "mlc": "MLC",
    "usd": "USD",
    "clasica": "Clasica",
}


@dataclass
class SeccionSheet:
    servicio: str
    moneda: str
    fecha: date | None
    fila_inicio: int
    items: list[dict]


def texto_normalizado(value) -> str:
    texto = str(value or "").strip().lower()
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(char for char in texto if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", texto).strip()


def safe_float(value):
    if value is None:
        return 0.0

    texto = str(value).strip()
    if not texto:
        return 0.0

    texto = texto.replace(" ", "")
    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    else:
        texto = texto.replace(",", ".")

    try:
        return float(texto)
    except ValueError:
        return 0.0


def get_col(row, index, default=""):
    return row[index].strip() if len(row) > index and row[index] is not None else default


def key_float(value):
    return round(float(value or 0), 4)


def detectar_servicio(row) -> str | None:
    titulo = texto_normalizado(get_col(row, 1))

    if not titulo:
        return None

    # if titulo == "usd" or titulo.startswith("usd "):
    #     return "usd"
    # if titulo == "mlc" or titulo.startswith("mlc "):
    #     return "mlc"
    # if "clasica" in titulo:
    #     return "clasica"
    # if "transf" in titulo:
    #     return "transferencia"
    # if "efect" in titulo:
    #     return "efectivo"
    # if "saldo" in titulo or "saido" in titulo:
    #     return "saldo"

    return None


def normalizar_moneda_segura(value, default=""):
    texto = str(value or "")
    if "USDT" in texto.upper():
        return default
    return normalizar_moneda(texto, default=default)


def moneda_desde_fila(row, fallback="BRL"):
    moneda = normalizar_moneda_segura(get_col(row, 3), default="")
    if moneda:
        return moneda

    for cell in row:
        moneda = normalizar_moneda_segura(cell, default="")
        if moneda:
            return moneda

    return fallback


def fecha_desde_fila(row) -> date | None:
    for cell in row:
        match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(cell or ""))
        if not match:
            continue

        dia, mes, anio = match.groups()
        try:
            return datetime(int(anio), int(mes), int(dia)).date()
        except ValueError:
            return None

    return None


def es_fila_vacia(row) -> bool:
    return not any(str(cell or "").strip() for cell in row)


def es_fila_encabezado(row) -> bool:
    return any("oferta" in texto_normalizado(cell) for cell in row)


def buscar_encabezado(rows, inicio):
    for index in range(inicio + 1, min(inicio + 8, len(rows))):
        if detectar_servicio(rows[index]):
            return None
        if es_fila_encabezado(rows[index]):
            return index
    return None


def deduplicar_ofertas(items):
    deduplicadas = {}
    for item in items:
        key = (
            item["moneda"],
            key_float(item["minimo"]),
        )
        deduplicadas[key] = item
    return sorted(
        deduplicadas.values(),
        key=lambda value: key_float(value["minimo"]),
    )


def deduplicar_saldo(items):
    deduplicadas = {}
    for item in items:
        key = (
            item["moneda"],
            key_float(item["monto_pago"]),
            int(item["cup"]),
        )
        deduplicadas[key] = item
    return list(deduplicadas.values())


def leer_items_seccion(rows, fila_servicio, fila_encabezado, servicio, moneda):
    items = []
    vio_datos = False

    for index in range(fila_encabezado + 1, len(rows)):
        row = rows[index]

        if detectar_servicio(row):
            break
        if es_fila_vacia(row):
            if vio_datos:
                break
            continue

        monto_pago = safe_float(get_col(row, 3))
        if monto_pago <= 0:
            continue

        if servicio == "saldo":
            saldo_cup = int(safe_float(get_col(row, 11)))
            if saldo_cup <= 0:
                continue
            items.append({
                "monto_pago": monto_pago,
                "cup": saldo_cup,
                "moneda": moneda,
                "fila": index + 1,
            })
            vio_datos = True
            continue

        tasa = safe_float(get_col(row, 10))
        if tasa <= 0 and servicio in {"transferencia", "efectivo"}:
            oferta_cup = safe_float(get_col(row, 8))
            if oferta_cup > 0:
                tasa = oferta_cup / monto_pago

        if tasa <= 0:
            continue

        items.append({
            "minimo": monto_pago,
            "tasa": tasa,
            "moneda": moneda,
            "fila": index + 1,
        })
        vio_datos = True

    if servicio == "saldo":
        return deduplicar_saldo(items)
    return deduplicar_ofertas(items)


def parsear_secciones(rows):
    secciones = []

    for index, row in enumerate(rows):
        servicio = detectar_servicio(row)
        if not servicio:
            continue

        fila_encabezado = buscar_encabezado(rows, index)
        if fila_encabezado is None:
            continue

        moneda = moneda_desde_fila(rows[fila_encabezado], fallback=moneda_desde_fila(row))
        items = leer_items_seccion(rows, index, fila_encabezado, servicio, moneda)
        if not items:
            continue

        secciones.append(SeccionSheet(
            servicio=servicio,
            moneda=moneda,
            fecha=fecha_desde_fila(row),
            fila_inicio=index + 1,
            items=items,
        ))

    return secciones


def seleccionar_secciones_vigentes(secciones):
    vigentes = {}

    for seccion in secciones:
        key = (seccion.servicio, seccion.moneda)
        actual = vigentes.get(key)
        if not actual:
            vigentes[key] = seccion
            continue

        fecha_actual = actual.fecha or date.min
        fecha_nueva = seccion.fecha or date.min
        if (fecha_nueva, seccion.fila_inicio) >= (fecha_actual, actual.fila_inicio):
            vigentes[key] = seccion

    return sorted(
        vigentes.values(),
        key=lambda seccion: (seccion.servicio, seccion.moneda),
    )


def construir_resultado(secciones):
    resultado = {
        "transferencia": [],
        "efectivo": [],
        "mlc": [],
        "usd": [],
        "clasica": [],
        "saldo": [],
    }
    meta = []

    for seccion in secciones:
        resultado[seccion.servicio].extend(seccion.items)
        meta.append({
            "servicio": seccion.servicio,
            "moneda": seccion.moneda,
            "fecha": seccion.fecha.isoformat() if seccion.fecha else None,
            "fila_inicio": seccion.fila_inicio,
            "items": len(seccion.items),
        })

    resultado["meta"] = {
        "secciones_usadas": meta,
    }
    return resultado


def obtener_rows_sheet():
    gc = gspread.service_account(
        filename=str(CREDENTIALS_FILE)
    )
    sheet = gc.open_by_key(SHEET_ID)
    worksheet = sheet.get_worksheet(0)
    return worksheet.get_all_values()


def cargar_ofertas_existentes(db: Session):
    existentes = {}
    duplicadas = []

    ofertas = (
        db.query(Oferta)
        .filter(
            Oferta.origen == ORIGEN_GOOGLE_SHEET,
            Oferta.servicio.in_(list(SERVICIOS_OFERTAS)),
        )
        .order_by(Oferta.id.desc())
        .all()
    )

    for oferta in ofertas:
        key = (
            oferta.servicio,
            oferta.moneda_pago,
            key_float(oferta.minimo_pago),
        )
        if key in existentes:
            duplicadas.append(oferta)
            continue
        existentes[key] = oferta

    return existentes, duplicadas


def cargar_saldos_existentes(db: Session):
    existentes = {}
    duplicadas = []

    paquetes = (
        db.query(PaqueteSaldo)
        .filter(PaqueteSaldo.origen == ORIGEN_GOOGLE_SHEET)
        .order_by(PaqueteSaldo.id.desc())
        .all()
    )

    for paquete in paquetes:
        key = (
            paquete.moneda_pago,
            key_float(paquete.monto_pago),
            int(paquete.saldo_cup),
        )
        if key in existentes:
            duplicadas.append(paquete)
            continue
        existentes[key] = paquete

    return existentes, duplicadas


def upsert_ofertas(db: Session, resultado):
    existentes, duplicadas = cargar_ofertas_existentes(db)

    db.query(Oferta).filter(
        Oferta.origen == ORIGEN_GOOGLE_SHEET,
        Oferta.servicio.in_(list(SERVICIOS_OFERTAS)),
    ).update({"activa": False}, synchronize_session=False)

    for oferta in duplicadas:
        oferta.activa = False

    for servicio in SERVICIOS_OFERTAS:
        for item in resultado[servicio]:
            key = (
                servicio,
                item["moneda"],
                key_float(item["minimo"]),
            )
            oferta = existentes.get(key)
            if not oferta:
                oferta = Oferta(
                    servicio=servicio,
                    nombre=NOMBRES_SERVICIO[servicio],
                    minimo_pago=item["minimo"],
                    moneda_pago=item["moneda"],
                    tasa=item["tasa"],
                    origen=ORIGEN_GOOGLE_SHEET,
                    activa=True,
                )
                db.add(oferta)
                existentes[key] = oferta
                continue

            oferta.nombre = NOMBRES_SERVICIO[servicio]
            oferta.minimo_pago = item["minimo"]
            oferta.moneda_pago = item["moneda"]
            oferta.tasa = item["tasa"]
            oferta.origen = ORIGEN_GOOGLE_SHEET
            oferta.activa = True

    return len(duplicadas)


def upsert_saldos(db: Session, resultado):
    existentes, duplicadas = cargar_saldos_existentes(db)

    db.query(PaqueteSaldo).filter(
        PaqueteSaldo.origen == ORIGEN_GOOGLE_SHEET,
    ).update({"activo": False}, synchronize_session=False)

    for paquete in duplicadas:
        paquete.activo = False

    for item in resultado["saldo"]:
        key = (
            item["moneda"],
            key_float(item["monto_pago"]),
            int(item["cup"]),
        )
        paquete = existentes.get(key)
        if not paquete:
            paquete = PaqueteSaldo(
                monto_pago=item["monto_pago"],
                moneda_pago=item["moneda"],
                saldo_cup=item["cup"],
                nombre=f'{item["cup"]} CUP',
                origen=ORIGEN_GOOGLE_SHEET,
                activo=True,
            )
            db.add(paquete)
            existentes[key] = paquete
            continue

        paquete.monto_pago = item["monto_pago"]
        paquete.moneda_pago = item["moneda"]
        paquete.saldo_cup = item["cup"]
        paquete.nombre = f'{item["cup"]} CUP'
        paquete.origen = ORIGEN_GOOGLE_SHEET
        paquete.activo = True

    return len(duplicadas)


def sync_ofertas(db: Session):
    ensure_runtime_columns(db)

    rows = obtener_rows_sheet()
    secciones = seleccionar_secciones_vigentes(
        parsear_secciones(rows)
    )
    resultado = construir_resultado(secciones)

    duplicadas_ofertas = upsert_ofertas(db, resultado)
    duplicadas_saldo = upsert_saldos(db, resultado)

    resultado["meta"].update({
        "filas_leidas": len(rows),
        "duplicadas_ofertas_desactivadas": duplicadas_ofertas,
        "duplicadas_saldo_desactivadas": duplicadas_saldo,
    })

    db.commit()
    return resultado
