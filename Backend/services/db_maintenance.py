from sqlalchemy import inspect
from sqlalchemy import text
from sqlalchemy.orm import Session

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.operador_rol import OperadorRol
from Backend.models.pedido_otros import PedidoOtros
from Backend.models.provincia_servicio import ProvinciaServicio


def _get_columns(
    db: Session,
    table_name: str
):
    inspector = inspect(
        db.get_bind()
    )

    if not inspector.has_table(
        table_name
    ):
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


def _add_index_if_missing(
    db: Session,
    table_name: str,
    index_name: str,
    columns: tuple[str, ...]
):
    inspector = inspect(
        db.get_bind()
    )

    if not inspector.has_table(
        table_name
    ):
        return

    table_columns = _get_columns(
        db,
        table_name
    )

    if not set(columns).issubset(table_columns):
        return

    existing = {
        index["name"]
        for index in inspector.get_indexes(
            table_name
        )
    }

    if index_name in existing:
        return

    db.execute(
        text(
            f"CREATE INDEX {index_name} "
            f"ON {table_name} ({', '.join(columns)})"
        )
    )
    db.commit()


def _add_unique_index_if_missing(
    db: Session,
    table_name: str,
    index_name: str,
    columns: tuple[str, ...]
):
    inspector = inspect(
        db.get_bind()
    )

    if not inspector.has_table(
        table_name
    ):
        return

    table_columns = _get_columns(
        db,
        table_name
    )

    if not set(columns).issubset(table_columns):
        return

    existing_indexes = {
        index["name"]
        for index in inspector.get_indexes(
            table_name
        )
    }
    existing_constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(
            table_name
        )
    }

    if index_name in existing_indexes or index_name in existing_constraints:
        return

    db.execute(
        text(
            f"CREATE UNIQUE INDEX {index_name} "
            f"ON {table_name} ({', '.join(columns)})"
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
    ensure_runtime_tables(
        db
    )
    OperadorRol.__table__.create(
        db.get_bind(),
        checkfirst=True
    )
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
    _add_column_if_missing(
        db,
        "pedidos",
        "idempotency_key",
        "idempotency_key VARCHAR"
    )

    _add_column_if_missing(
        db,
        "pedidos",
        "operador_asignado_id",
        "operador_asignado_id INTEGER"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "asignado_en",
        "asignado_en TIMESTAMP"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "lock_expires_at",
        "lock_expires_at TIMESTAMP"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "redirigido_a_operador_id",
        "redirigido_a_operador_id INTEGER"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "redirigido_por_operador_id",
        "redirigido_por_operador_id INTEGER"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "redirigido_en",
        "redirigido_en TIMESTAMP"
    )
    _add_column_if_missing(
        db,
        "pedidos",
        "redireccion_mensaje",
        "redireccion_mensaje VARCHAR"
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
        "operadores",
        "rol",
        "rol VARCHAR DEFAULT 'operador'"
    )
    _add_column_if_missing(
        db,
        "operadores",
        "password_hash",
        "password_hash VARCHAR"
    )
    _add_column_if_missing(
        db,
        "operadores",
        "foto_url",
        "foto_url VARCHAR"
    )

    _add_column_if_missing(
        db,
        "operadores",
        "permisos_config",
        "permisos_config VARCHAR"
    )

    _add_column_if_missing(
        db,
        "metodos_pago",
        "imagen_url",
        "imagen_url VARCHAR"
    )

    _add_column_if_missing(
        db,
        "pedidos",
        "cuenta_pago_id",
        "cuenta_pago_id INTEGER"
    )

    _add_column_if_missing(
        db,
        "pedido_efectivo",
        "documento_identidad_url",
        "documento_identidad_url VARCHAR"
    )

    _add_column_if_missing(
        db,
        "puntos_recogida",
        "provincia_id",
        "provincia_id INTEGER"
    )

    ensure_carousel_columns(db)

    ensure_runtime_indexes(
        db
    )


def ensure_carousel_columns(db: Session):
    _add_column_if_missing(
        db,
        "promociones",
        "tipo",
        "tipo VARCHAR NOT NULL DEFAULT 'promocion'"
    )
    _add_column_if_missing(
        db,
        "promociones",
        "titulo",
        "titulo VARCHAR NOT NULL DEFAULT ''"
    )
    _add_column_if_missing(
        db,
        "promociones",
        "subtitulo",
        "subtitulo VARCHAR NOT NULL DEFAULT ''"
    )
    _add_column_if_missing(
        db,
        "promociones",
        "orden",
        "orden INTEGER NOT NULL DEFAULT 0"
    )
    if _get_columns(db, "promociones"):
        db.execute(text(
            "UPDATE promociones SET titulo = descripcion "
            "WHERE titulo IS NULL OR titulo = ''"
        ))
        db.commit()


def ensure_runtime_tables(
    db: Session
):
    ProvinciaServicio.__table__.create(
        bind=db.get_bind(),
        checkfirst=True
    )
    ArchivoPedido.__table__.create(
        bind=db.get_bind(),
        checkfirst=True
    )
    PedidoOtros.__table__.create(
        bind=db.get_bind(),
        checkfirst=True
    )


def ensure_runtime_indexes(
    db: Session
):
    for index_name, columns in [
        ("ix_pedidos_report_created_at", ("created_at",)),
        ("ix_pedidos_report_estado", ("estado",)),
        ("ix_pedidos_report_servicio", ("servicio",)),
        ("ix_pedidos_report_moneda_pago", ("moneda_pago",)),
        ("ix_pedidos_report_operador_id", ("operador_id",)),
        ("ix_pedidos_report_tipo_pago_id", ("tipo_pago_id",)),
        ("ix_pedidos_report_cuenta_pago_id", ("cuenta_pago_id",)),
        ("ix_pedidos_report_fecha_estado", ("created_at", "estado")),
        ("ix_pedidos_report_fecha_servicio", ("created_at", "servicio")),
    ]:
        _add_index_if_missing(
            db,
            "pedidos",
            index_name,
            columns
        )
    _add_unique_index_if_missing(
        db,
        "pedidos",
        "ux_pedidos_idempotency_key",
        ("idempotency_key",)
    )
