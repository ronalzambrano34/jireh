from io import BytesIO
from pathlib import Path
import sys
import tempfile

from fastapi import UploadFile
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Backend.database import Base

from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.cliente import Cliente
from Backend.models.configuracion import Configuracion
from Backend.models.contacto import Contacto
from Backend.models.metodo_pago import MetodoPago
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.oferta import Oferta
from Backend.models.operador import Operador
from Backend.models.paquete_saldo import PaqueteSaldo
from Backend.models.pedido import Pedido
from Backend.models.pedido_divisa import PedidoDivisa
from Backend.models.pedido_efectivo import PedidoEfectivo
from Backend.models.pedido_historial import PedidoHistorial
from Backend.models.pedido_saldo import PedidoSaldo
from Backend.models.pedido_transferencia import PedidoTransferencia
from Backend.models.provincia_servicio import ProvinciaServicio
from Backend.models.punto_recogida import PuntoRecogida

from Backend.schemas.oferta import OfertaCreate, OfertaUpdate
from Backend.schemas.paquete_saldo import PaqueteSaldoCreate, PaqueteSaldoUpdate
from Backend.services.archivo_pedido_service import (
    guardar_upload_pedido,
    listar_archivos_pedido
)
from Backend.services.oferta_service import (
    actualizar_oferta,
    crear_oferta,
    eliminar_oferta,
    listar_ofertas
)
from Backend.services.paquete_saldo_service import (
    actualizar_paquete_saldo,
    crear_paquete_saldo,
    eliminar_paquete_saldo,
    listar_paquetes_saldo
)
from Backend.services.reporte_service import reporte_general


def _assert(condition, message):
    if not condition:
        raise AssertionError(message)


def crear_db_temporal():
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


def sembrar_base(db):
    operador = Operador(
        nombre="Admin Smoke",
        codigo_operador="AS",
        telefono="+5355511111"
    )
    cliente = Cliente(
        nombre="Cliente Smoke",
        telefono="+559500000000",
        pais="Brasil"
    )
    metodo = MetodoPago(
        nombre="Pix Smoke",
        moneda="BRL",
        activo=True
    )

    db.add_all([
        operador,
        cliente,
        metodo,
    ])
    db.commit()

    return operador, cliente, metodo


def run():
    _db_path, db = crear_db_temporal()

    try:
        operador, cliente, metodo = sembrar_base(
            db
        )

        oferta = crear_oferta(
            db,
            OfertaCreate(
                servicio=" Transferencia ",
                nombre="Oferta Smoke",
                tasa=120,
                minimo_pago=10,
                moneda_pago="brl"
            )
        )
        _assert(
            oferta.servicio == "transferencia",
            "oferta: servicio no normalizado"
        )
        _assert(
            oferta.moneda_pago == "BRL",
            "oferta: moneda no normalizada"
        )

        oferta = actualizar_oferta(
            db,
            oferta.id,
            OfertaUpdate(
                tasa=121,
                moneda_pago="usd"
            )
        )
        _assert(
            oferta.tasa == 121,
            "oferta: tasa no actualizada"
        )
        _assert(
            oferta.moneda_pago == "USD",
            "oferta: moneda actualizada no normalizada"
        )
        _assert(
            len(listar_ofertas(db, incluir_inactivas=True)) == 1,
            "oferta: listado no devuelve la oferta"
        )
        oferta = eliminar_oferta(
            db,
            oferta.id
        )
        _assert(
            oferta.activa is False,
            "oferta: baja logica no aplicada"
        )
        _assert(
            listar_ofertas(db) == [],
            "oferta: listado activo incluye baja logica"
        )

        paquete = crear_paquete_saldo(
            db,
            PaqueteSaldoCreate(
                nombre="Saldo Smoke",
                monto_pago=10,
                moneda_pago="brl",
                saldo_cup=1000
            )
        )
        _assert(
            paquete.moneda_pago == "BRL",
            "paquete: moneda no normalizada"
        )
        paquete = actualizar_paquete_saldo(
            db,
            paquete.id,
            PaqueteSaldoUpdate(
                monto_pago=12,
                moneda_pago="usd"
            )
        )
        _assert(
            str(paquete.monto_pago).startswith("12"),
            "paquete: monto no actualizado"
        )
        _assert(
            paquete.moneda_pago == "USD",
            "paquete: moneda actualizada no normalizada"
        )
        _assert(
            len(listar_paquetes_saldo(db, incluir_inactivos=True)) == 1,
            "paquete: listado no devuelve el paquete"
        )
        paquete = eliminar_paquete_saldo(
            db,
            paquete.id
        )
        _assert(
            paquete.activo is False,
            "paquete: baja logica no aplicada"
        )
        _assert(
            listar_paquetes_saldo(db) == [],
            "paquete: listado activo incluye baja logica"
        )

        pedido = Pedido(
            codigo_operacion="JH-SMOKE-UPLOAD",
            cliente_id=cliente.id,
            operador_id=operador.id,
            servicio="transferencia",
            estado="pendiente_pago",
            monto_pago=100,
            moneda_pago="BRL",
            tipo_pago_id=metodo.id,
            tasa_usada=120,
            tasa_final=120,
            monto_resultado=12000,
            ganancia=5,
        )
        db.add(
            pedido
        )
        db.commit()

        upload = UploadFile(
            file=BytesIO(
                b"abc123"
            ),
            filename="comprobante.jpg"
        )
        archivo = guardar_upload_pedido(
            db,
            "JH-SMOKE-UPLOAD",
            "comprobante_cliente",
            upload,
            usuario="smoke",
            notas="ok"
        )
        _assert(
            archivo["tipo"] == "comprobante_cliente",
            "archivo: tipo inesperado"
        )
        _assert(
            Path(archivo["ruta_archivo"]).exists(),
            "archivo: upload no creo archivo local"
        )
        _assert(
            listar_archivos_pedido(db, "JH-SMOKE-UPLOAD")[0]["nombre_archivo"] == "comprobante.jpg",
            "archivo: listado no devuelve nombre original"
        )
        db.refresh(
            pedido
        )
        _assert(
            pedido.comprobante_pago == archivo["ruta_archivo"],
            "archivo: comprobante_cliente no actualizo pedido"
        )

        operador_id = operador.id
        consultas_reporte = []

        def registrar_consulta(
            _conn,
            _cursor,
            statement,
            _parameters,
            _context,
            _executemany
        ):
            if statement.lstrip().upper().startswith(
                "SELECT"
            ):
                consultas_reporte.append(
                    statement
                )

        event.listen(
            db.get_bind(),
            "before_cursor_execute",
            registrar_consulta
        )
        try:
            reporte = reporte_general(
                db,
                servicio="TRANSFERENCIA",
                moneda_pago="brl",
                operador_id=operador_id
            )
        finally:
            event.remove(
                db.get_bind(),
                "before_cursor_execute",
                registrar_consulta
            )
        _assert(
            reporte["resumen"]["total_pedidos"] == 1,
            "reporte: total inesperado"
        )
        _assert(
            reporte["por_estado"][0]["clave"] == "pendiente_pago",
            "reporte: agrupacion por estado inesperada"
        )
        _assert(
            reporte["por_operador"][0]["clave"] == operador_id,
            "reporte: operador debe conservar su identificador numerico"
        )
        _assert(
            len(consultas_reporte) == 1,
            "reporte: debe resolverse en una sola consulta"
        )

    finally:
        db.close()

    print("OK: smoke admin, reportes y evidencias completado")


if __name__ == "__main__":
    run()
