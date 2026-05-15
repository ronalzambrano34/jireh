import gspread

from sqlalchemy.orm import Session

from models.oferta import Oferta
from models.paquete_saldo import (
    PaqueteSaldo
)


SHEET_ID = "1QZaKLpvi3ZqigaxF1n4sYQ57jO6XY5wW6CiYzWA56OA"

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

def sync_ofertas(
    db: Session
):

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
                        "tasa": safe_float(oferta)
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
                        "tasa": safe_float(oferta)
                    })
        
        # ---------- SALDO ----------

        if (
            "saldo"
            == titulo
        ):

            for j in range(i + 3, min(i + 7, len(rows))):
                r = rows[j]

                pix = get_col(r, 3)
                cup = get_col(r, 11)

                if pix and cup:
                    saldo.append({
                        "pix": safe_float(pix),
                        "cup": int(safe_float(cup))
                    })

    # limpiar ofertas viejas

    db.query(
        Oferta
    ).update(
        {
            "activa":
            False
        }
    )

    db.commit()

    # insertar transferencias

    for item in transferencia:

        nueva = Oferta(

            servicio=
            "transferencia",

            nombre=
            "Transferencia",

            tasa=
            item["tasa"],

            minimo_brl=
            item["minimo"],

            activa=True
        )

        db.add(
            nueva
        )

    # insertar efectivo

    for item in efectivo:

        nueva = Oferta(

            servicio=
            "efectivo",

            nombre=
            "Efectivo",

            tasa=
            item["tasa"],

            minimo_brl=
            item["minimo"],

            activa=True
        )

        db.add(
            nueva
        )

    # limpiar saldo

    db.query(
        PaqueteSaldo
    ).delete()

    db.commit()

    # insertar saldo

    for item in saldo:

        paquete = (
            PaqueteSaldo(

                nombre=
                f'{item["cup"]} CUP',

                pix_brl=
                item["pix"],

                saldo_cup=
                item["cup"],

                activo=True
            )
        )

        db.add(
            paquete
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