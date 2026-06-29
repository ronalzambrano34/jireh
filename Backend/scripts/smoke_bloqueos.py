from pathlib import Path
import sys
import tempfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Backend.database import Base

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.cliente import Cliente
from Backend.models.contacto import Contacto
from Backend.models.metodo_pago import MetodoPago
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.oferta import Oferta
from Backend.models.operador import Operador
from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_historial import PedidoHistorial
from Backend.models.pedido_otros import PedidoOtros
from Backend.models.pedido_saldo import PedidoSaldo
from Backend.models.pedido_transferencia import PedidoTransferencia
from Backend.models.provincia_servicio import ProvinciaServicio
from Backend.models.punto_recogida import PuntoRecogida

from Backend.services.pedido_estado import PedidoEstado
from Backend.services.pedido_service import (
    PedidoConflictError,
    liberar_bloqueo_pedido,
    redirigir_pedido_operador,
    tomar_operacion_pedido,
)


def _assert(condition, message):
    if not condition:
        raise AssertionError(message)


def _assert_conflict(action, message):
    try:
        action()
    except PedidoConflictError:
        return
    raise AssertionError(message)


def _crear_db_temporal():
    tmp = tempfile.NamedTemporaryFile(
        suffix=".sqlite",
        delete=False
    )
    tmp.close()

    engine = create_engine(
        f"sqlite:///{tmp.name}"
    )
    Base.metadata.create_all(
        bind=engine
    )

    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )

    return tmp.name, SessionLocal()


def _sembrar(db):
    metodo = MetodoPago(
        nombre="Pix Bloqueos",
        moneda="BRL",
        activo=True
    )
    operador_a = Operador(
        nombre="Operador A",
        codigo_operador="BQA",
        telefono="+5355510001",
        rol="operador"
    )
    operador_b = Operador(
        nombre="Operador B",
        codigo_operador="BQB",
        telefono="+5355510002",
        rol="operador"
    )
    operador_c = Operador(
        nombre="Operador C",
        codigo_operador="BQC",
        telefono="+5355510003",
        rol="operador"
    )
    db.add_all([
        metodo,
        operador_a,
        operador_b,
        operador_c,
    ])
    db.flush()

    pedido = Pedido(
        codigo_operacion="JH-BLOQUEO-001",
        servicio="otros",
        estado=PedidoEstado.PAGO_CONFIRMADO,
        monto_pago=100,
        moneda_pago="BRL",
        tipo_pago_id=metodo.id,
        operador_id=operador_a.id,
        tasa_usada=1,
        bonificacion=0,
        tasa_final=1,
        monto_resultado=100,
        ganancia=0,
        observaciones="Pedido para prueba de bloqueo"
    )
    db.add(pedido)
    db.commit()

    return pedido.codigo_operacion, operador_a, operador_b, operador_c


def run():
    db_path, db = _crear_db_temporal()

    try:
        codigo, operador_a, operador_b, operador_c = _sembrar(db)

        tomado = tomar_operacion_pedido(
            db,
            codigo,
            operador_a
        )
        _assert(
            tomado["operador_asignado_id"] == operador_a.id,
            "tomar: operador A no bloqueo el pedido"
        )

        _assert_conflict(
            lambda: tomar_operacion_pedido(db, codigo, operador_b),
            "tomar: operador B pudo tomar un pedido bloqueado por A"
        )
        _assert_conflict(
            lambda: liberar_bloqueo_pedido(db, codigo, operador_b),
            "liberar: operador B pudo liberar un pedido bloqueado por A"
        )

        transferido = redirigir_pedido_operador(
            db,
            codigo,
            operador_c.id,
            "Transferencia a C",
            operador_a
        )
        _assert(
            transferido["redirigido_a_operador_id"] == operador_c.id,
            "transferir: no redirigio al operador C"
        )
        _assert(
            transferido["operador_asignado_id"] is None,
            "transferir: no libero el pedido al redirigir"
        )

        tomado_c = tomar_operacion_pedido(
            db,
            codigo,
            operador_c
        )
        _assert(
            tomado_c["operador_asignado_id"] == operador_c.id,
            "tomar: operador C no pudo tomar el pedido transferido"
        )

        _assert_conflict(
            lambda: redirigir_pedido_operador(
                db,
                codigo,
                operador_c.id,
                "Transferencia a C",
                operador_a
            ),
            "transferir: operador A pudo reintentar sobre un pedido tomado por C"
        )
        _assert_conflict(
            lambda: redirigir_pedido_operador(
                db,
                codigo,
                operador_a.id,
                "Transferencia a A",
                operador_b
            ),
            "transferir: operador B pudo transferir un pedido tomado por C"
        )

        liberado = liberar_bloqueo_pedido(
            db,
            codigo,
            operador_c
        )
        _assert(
            liberado["operador_asignado_id"] is None,
            "liberar: operador C no libero su bloqueo"
        )

        print("OK: smoke de bloqueos completado")

    finally:
        db.close()
        Path(db_path).unlink(
            missing_ok=True
        )


if __name__ == "__main__":
    run()
