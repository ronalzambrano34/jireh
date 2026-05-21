from pathlib import Path

import gspread

from sqlalchemy.orm import Session

from Backend.models.oferta import Oferta
from Backend.models.paquete_saldo import (PaqueteSaldo)
from Backend.services.db_maintenance import ensure_runtime_columns
from Backend.services.monedas import normalizar_moneda


SHEET_ID = "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"
ORIGEN_GOOGLE_SHEET = "google_sheet"
CREDENTIALS_FILE = Path(__file__).resolve().parents[1] / "credentials.json"


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


def deduplicar_ofertas(items):
    deduplicadas = {}

    for item in items:
        key = (
            item["moneda"],
            float(item["minimo"])
        )
        deduplicadas[key] = item

    return list(
        deduplicadas.values()
    )


def deduplicar_saldo(items):
    deduplicadas = {}

    for item in items:
        key = (
            item["moneda"],
            float(item["monto_pago"]),
            int(item["cup"])
        )
        deduplicadas[key] = item

    return list(
        deduplicadas.values()
    )


def oferta_cambio_detectado(
    oferta,
    item: dict
):

    if not oferta:
        return True

    return any([
        float(
            oferta.tasa
        ) != float(
            item["tasa"]
        ),

        float(
            oferta.minimo_pago
        ) != float(
            item["minimo"]
        ),

        oferta.moneda_pago
        !=
        item["moneda"],

        not oferta.activa
    ])


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
            Oferta.origen
            ==
            ORIGEN_GOOGLE_SHEET,

            Oferta.servicio
            ==
            servicio,

            Oferta.minimo_pago
            ==
            item["minimo"],

            Oferta.moneda_pago
            ==
            item["moneda"]
        )
        .first()
    )

    cambio = oferta_cambio_detectado(
        oferta,
        item
    )

    if not oferta:

        oferta = Oferta(

            servicio=
            servicio,

            nombre=
            nombre,

            minimo_pago=
            item["minimo"],

            moneda_pago=
            item["moneda"],

            tasa=
            item["tasa"],

            origen=
            ORIGEN_GOOGLE_SHEET,

            activa=True
        )

        db.add(
            oferta
        )

        print(
            f"🆕 Nueva oferta "
            f"{servicio} "
            f"{item['moneda']} "
            f"{item['minimo']}"
        )

        return oferta

    # Si no cambió nada → no tocar DB

    if not cambio:

        print(
            f"✅ Sin cambios "
            f"{servicio} "
            f"{item['moneda']} "
            f"{item['minimo']}"
        )

        oferta.activa = True

        return oferta

    print(
        f"🔄 Oferta actualizada "
        f"{servicio} "
        f"{item['moneda']} "
        f"{item['minimo']}"
    )

    oferta.nombre = nombre
    oferta.tasa = item["tasa"]
    oferta.origen = ORIGEN_GOOGLE_SHEET
    oferta.activa = True

    return oferta


def saldo_cambio_detectado(
    paquete,
    item
):

    if not paquete:
        return True

    return any([
        float(
            paquete.monto_pago
        ) != float(
            item["monto_pago"]
        ),

        paquete.moneda_pago
        !=
        item["moneda"],

        int(
            paquete.saldo_cup
        ) != int(
            item["cup"]
        ),

        not paquete.activo
    ])


def upsert_paquete_saldo_sheet(
    db: Session,
    item: dict
):

    paquete = (
        db.query(
            PaqueteSaldo
        )
        .filter(
            PaqueteSaldo.origen
            ==
            ORIGEN_GOOGLE_SHEET,

            PaqueteSaldo.monto_pago
            ==
            item["monto_pago"],

            PaqueteSaldo.moneda_pago
            ==
            item["moneda"],

            PaqueteSaldo.saldo_cup
            ==
            item["cup"]
        )
        .first()
    )

    cambio = saldo_cambio_detectado(
        paquete,
        item
    )

    if not paquete:

        paquete = (
            PaqueteSaldo(

                monto_pago=
                item["monto_pago"],

                moneda_pago=
                item["moneda"],

                saldo_cup=
                item["cup"],

                nombre=
                f'{item["cup"]} CUP',

                origen=
                ORIGEN_GOOGLE_SHEET,

                activo=True
            )
        )

        db.add(
            paquete
        )

        print(
            f"🆕 Nuevo saldo "
            f"{item['cup']} CUP"
        )

        return paquete

    if not cambio:

        print(
            f"✅ Saldo sin cambios "
            f"{item['cup']} CUP"
        )

        paquete.activo = True

        return paquete

    print(
        f"🔄 Saldo actualizado "
        f"{item['cup']} CUP"
    )

    paquete.nombre = (
        f'{item["cup"]} CUP'
    )

    paquete.origen = (
        ORIGEN_GOOGLE_SHEET
    )

    paquete.activo = True

    return paquete


def sync_ofertas(
    db: Session
):

    ensure_runtime_columns(
        db
    )

    gc = gspread.service_account(
        filename=str(
            CREDENTIALS_FILE
        )
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
    mlc = []
    usd = []
    clasica = []

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


        # ---------- MLC ----------

        if (
            "mlc"
            in titulo
        ):

            for j in range(i + 3, min(i + 4, len(rows))):
                r = rows[j]

                minimo = safe_float(get_col(r, 3))

                oferta = get_col(r, 10)

                if oferta:
                    mlc.append({
                        "minimo": minimo,
                        "tasa": safe_float(oferta),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })
                    
                    
        # ---------- USD ----------
        
        if (
            "usd"
            in titulo
        ):

            for j in range(i + 3, min(i + 4, len(rows))):
                r = rows[j]

                minimo = safe_float(get_col(r, 3))

                oferta = get_col(r, 10)

                if oferta:
                    usd.append({
                        "minimo": minimo,
                        "tasa": safe_float(oferta),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })
                    
                    
        # ---------- CLASICA ----------
        if (
            "clasica"
            in titulo
        ):

            for j in range(i + 3, min(i + 4, len(rows))):
                r = rows[j]

                minimo = safe_float(get_col(r, 3))

                oferta = get_col(r, 10)

                if oferta:
                    clasica.append({
                        "minimo": minimo,
                        "tasa": safe_float(oferta),
                        "moneda": get_moneda(
                            r,
                            moneda_titulo
                        )
                    })
                    


    transferencia = deduplicar_ofertas(
        transferencia
    )
    efectivo = deduplicar_ofertas(
        efectivo
    )
    mlc = deduplicar_ofertas(
        mlc
    )
    usd = deduplicar_ofertas(
        usd
    )
    clasica = deduplicar_ofertas(
        clasica
    )
    saldo = deduplicar_saldo(
        saldo
    )

    # El sync solo desactiva registros que el propio sync creo antes.

    db.query(
        Oferta
    ).filter(
        Oferta.origen == ORIGEN_GOOGLE_SHEET,
        Oferta.servicio.in_(
            [
                "transferencia",
                "mlc",
                "usd",
                "clasica",
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
        
    # crear o reactivar mlc

    for item in mlc:
        upsert_oferta_sheet(
            db,
            "mlc",
            "MLC",
            item
        )

    # crear o reactivar usd

    for item in usd:
        upsert_oferta_sheet(
            db,
            "usd",
            "USD",
            item
        )

    # crear o reactivar clasica

    for item in clasica:
        upsert_oferta_sheet(
            db,
            "clasica",
            "Clasica",
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

        "mlc":
        mlc,

        "usd":
        usd,

        "clasica":
        clasica,

        "saldo":
        saldo
    }

