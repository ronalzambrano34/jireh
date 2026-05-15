import gspread

from sqlalchemy.orm import Session

from models.oferta import Oferta
from models.paquete_saldo import (
    PaqueteSaldo
)
from services.db_maintenance import ensure_runtime_columns
from services.monedas import normalizar_moneda


SHEET_ID = "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"
ORIGEN_GOOGLE_SHEET = "google_sheet"


def safe_float(value):
    if value is None:
        return 0.0
    value = str(value).replace(",", ".").strip()
    if value == "":
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def get_col(row, index, default=""):
    return row[index].strip() if len(row) > index else default


def get_moneda(
    row,
    fallback="BRL"
):
    for cell in row:
        moneda = normalizar_moneda(
            cell,
            default=""
        )

        if moneda:
            return moneda

    return fallback


def upsert_oferta_sheet(
    db: Session,
    servicio: str,
    nombre: str,
    item: dict
):
    oferta = (
        db.query(
            Oferta
        )
        .filter(
            Oferta.origen == ORIGEN_GOOGLE_SHEET,
            Oferta.servicio == servicio,
            Oferta.minimo_pago == item["minimo"],
            Oferta.moneda_pago == item["moneda"]
        )
        .order_by(
            Oferta.activa.desc()
        )
        .first()
    )

    if not oferta:
        oferta = Oferta(
            servicio=servicio,
            nombre=nombre,
            minimo_pago=item["minimo"],
            moneda_pago=item["moneda"]
        )

        db.add(
            oferta
        )

    oferta.nombre = nombre
    oferta.tasa = item["tasa"]
    oferta.origen = ORIGEN_GOOGLE_SHEET
    oferta.activa = True

    return oferta


def upsert_paquete_saldo_sheet(
    db: Session,
    item: dict
):
    paquete = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.origen == ORIGEN_GOOGLE_SHEET,
            PaqueteSaldo.monto_pago == item["monto_pago"],
            PaqueteSaldo.moneda_pago == item["moneda"],
            PaqueteSaldo.saldo_cup == item["cup"]
        )
        .order_by(
            PaqueteSaldo.activo.desc()
        )
        .first()
    )

    if not paquete:
        paquete = PaqueteSaldo(
            monto_pago=item["monto_pago"],
            moneda_pago=item["moneda"],
            saldo_cup=item["cup"]
        )

        db.add(
            paquete
        )

    paquete.nombre = f'{item["cup"]} CUP'
    paquete.origen = ORIGEN_GOOGLE_SHEET
    paquete.activo = True

    return paquete


def sync_ofertas(
    db: Session
):

    ensure_runtime_columns(
        db
    )

    gc = gspread.service_account(
        filename="credentials.json"
    )

    sheet = gc.open_by_key(
        SHEET_ID
    )

    worksheet = (
        sheet.get_worksheet(0)
    )

    rows = (
        worksheet.get_all_values()
    )

    transferencia = []
    efectivo = []
    saldo = []

    for i, row in enumerate(rows):

        titulo = (
            row[1]
            .strip()
            .lower()
            if len(row) > 1
            else ""
        )

        moneda_titulo = get_moneda(
            row
        )

        # ---------- TRANSFERENCIA ----------

        if (
            "transferencia"
            in titulo
        ):

            for j in range(i + 3, min(i + 8, len(rows))):
                r = rows[j]

                minimo = safe_float(get_col(r, 3))

                oferta = get_col(r, 10)

                if oferta:
                    transferencia.append({
                        "minimo": minimo,
                        "tasa": safe_float(oferta),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })

        # ---------- EFECTIVO ----------

        if (
            "efectivo"
            in titulo
        ):

            for j in range(i + 3, min(i + 8, len(rows))):
                r = rows[j]

                minimo = safe_float(get_col(r, 3))

                oferta = get_col(r, 10)

                if oferta:
                    efectivo.append({
                        "minimo": minimo,
                        "tasa": safe_float(oferta),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })

        # ---------- SALDO ----------

        if (
            "saldo"
            == titulo
        ):

            for j in range(i + 3, min(i + 7, len(rows))):
                r = rows[j]

                monto_pago = get_col(r, 3)
                cup = get_col(r, 11)

                if monto_pago and cup:
                    saldo.append({
                        "monto_pago": safe_float(monto_pago),
                        "cup": int(safe_float(cup)),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })

    # El sync solo desactiva registros que el propio sync creo antes.

    db.query(
        Oferta
    ).filter(
        Oferta.origen == ORIGEN_GOOGLE_SHEET,
        Oferta.servicio.in_(
            [
                "transferencia",
                "efectivo"
            ]
        )
    ).update(
        {
            "activa": False
        },
        synchronize_session=False
    )

    db.query(
        PaqueteSaldo
    ).filter(
        PaqueteSaldo.origen == ORIGEN_GOOGLE_SHEET
    ).update(
        {
            "activo": False
        },
        synchronize_session=False
    )

    # crear o reactivar transferencias

    for item in transferencia:
        upsert_oferta_sheet(
            db,
            "transferencia",
            "Transferencia",
            item
        )

    # crear o reactivar efectivo

    for item in efectivo:
        upsert_oferta_sheet(
            db,
            "efectivo",
            "Efectivo",
            item
        )

    # crear o reactivar paquetes de saldo

    for item in saldo:
        upsert_paquete_saldo_sheet(
            db,
            item
        )

    db.commit()

    return {

        "transferencia":
        transferencia,

        "efectivo":
        efectivo,

        "saldo":
        saldo
    }
