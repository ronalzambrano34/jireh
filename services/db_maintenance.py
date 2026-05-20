from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.orm import Session


def _get_columns(
    db: Session,
    table_name: str
):
    inspector = inspect(
        db.get_bind()
    )

    if table_name not in inspector.get_table_names():
        return set()

    return {
        column["name"]
        for column in inspector.get_columns(
            table_name
        )
    }


def _add_column_if_missing(
    db: Session,
    table_name: str,
    column_name: str,
    ddl: str
):
    columns = _get_columns(
        db,
        table_name
    )

    if not columns or column_name in columns:
        return

    db.execute(
        text(
            f"ALTER TABLE {table_name} "
            f"ADD COLUMN {ddl}"
        )
    )

    db.commit()


def _rename_column_if_needed(
    db: Session,
    table_name: str,
    old_name: str,
    new_name: str
):
    columns = _get_columns(
        db,
        table_name
    )

    if not columns:
        return

    if old_name not in columns or new_name in columns:
        return

    db.execute(
        text(
            f"ALTER TABLE {table_name} "
            f"RENAME COLUMN {old_name} TO {new_name}"
        )
    )

    db.commit()


def ensure_runtime_columns(
    db: Session
):
    _rename_column_if_needed(
        db,
        "ofertas",
        "minimo_brl",
        "minimo_pago"
    )
    _add_column_if_missing(
        db,
        "ofertas",
        "moneda_pago",
        "moneda_pago VARCHAR DEFAULT 'BRL'"
    )
    _add_column_if_missing(
        db,
        "ofertas",
        "origen",
        "origen VARCHAR DEFAULT 'manual'"
    )

    _rename_column_if_needed(
        db,
        "paquetes_saldo",
        "pix_brl",
        "monto_pago"
    )
    _add_column_if_missing(
        db,
        "paquetes_saldo",
        "moneda_pago",
        "moneda_pago VARCHAR DEFAULT 'BRL'"
    )
    _add_column_if_missing(
        db,
        "paquetes_saldo",
        "origen",
        "origen VARCHAR DEFAULT 'manual'"
    )

    _rename_column_if_needed(
        db,
        "pedidos",
        "monto_brl",
        "monto_pago"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "moneda_pago",
        "moneda_pago VARCHAR DEFAULT 'BRL'"
    )
    _rename_column_if_needed(
        db,
        "pedido_transferencia",
        "telefono_opcional",
        "telefono_destinatario"
    )
    _add_column_if_missing(
        db,
        "pedido_transferencia",
        "telefono_destinatario",
        "telefono_destinatario VARCHAR"
    )

    _rename_column_if_needed(
        db,
        "pedido_efectivo",
        "numero_telefono",
        "telefono_destinatario"
    )
    _add_column_if_missing(
        db,
        "pedido_efectivo",
        "telefono_destinatario",
        "telefono_destinatario VARCHAR"
    )

    _rename_column_if_needed(
        db,
        "pedido_saldo",
        "numero_telefono",
        "telefono_destinatario"
    )
    _add_column_if_missing(
        db,
        "pedido_saldo",
        "telefono_destinatario",
        "telefono_destinatario VARCHAR"
    )

    _add_column_if_missing(
        db,
        "pedido_divisa",
        "telefono_destinatario",
        "telefono_destinatario VARCHAR"
    )

    _add_column_if_missing(
        db,
        "contactos",
        "numero_tarjeta",
        "numero_tarjeta VARCHAR"
    )
    _add_column_if_missing(
        db,
        "contactos",
        "tipo_tarjeta",
        "tipo_tarjeta VARCHAR"
    )
    _add_column_if_missing(
        db,
        "contactos",
        "documento_identidad_url",
        "documento_identidad_url VARCHAR"
    )

    _add_column_if_missing(
        db,
        "pedido_efectivo",
        "documento_identidad_url",
        "documento_identidad_url VARCHAR"
    )

