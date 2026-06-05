from pathlib import Path
import sys
import tempfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Backend.database import Base

from Backend.models.cliente import Cliente
from Backend.models.configuracion import Configuracion
from Backend.models.contacto import Contacto
from Backend.models.archivo_pedido import ArchivoPedido
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

from Backend.schemas.archivo_pedido import ArchivoPedidoCreate
from Backend.schemas.pedido_divisa import PedidoDivisaCreate
from Backend.schemas.pedido_efectivo import PedidoEfectivoCreate
from Backend.schemas.pedido_saldo import PedidoSaldoCreate
from Backend.schemas.pedido_transferencia import PedidoTransferenciaCreate

from Backend.services.archivo_pedido_service import (
    listar_archivos_pedido,
    registrar_archivo_pedido
)
from Backend.services.pedido_divisa_service import crear_pedido_divisa
from Backend.services.pedido_efectivo_service import crear_pedido_efectivo
from Backend.services.pedido_saldo_service import crear_pedido_saldo
from Backend.services.pedido_service import (
    actualizar_estado_pedido,
    obtener_pedido_por_codigo
)
from Backend.services.pedido_transferencia_service import crear_pedido_transferencia


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


def sembrar_datos(db):
    cliente = Cliente(
        nombre="Cliente Smoke",
        telefono="+559595959595",
        pais="Brasil",
        moneda_preferida="BRL"
    )
    operador = Operador(
        nombre="Operador Smoke",
        codigo_operador="SM",
        telefono="+5355511111"
    )
    metodo = MetodoPago(
        nombre="Pix Smoke",
        moneda="BRL",
        activo=True
    )
    oferta_transferencia = Oferta(
        servicio="transferencia",
        nombre="Transferencia BRL",
        tasa=118,
        minimo_pago=0,
        moneda_pago="BRL",
        activa=True
    )
    oferta_efectivo = Oferta(
        servicio="efectivo",
        nombre="Efectivo BRL",
        tasa=117,
        minimo_pago=0,
        moneda_pago="BRL",
        activa=True
    )
    provincia = ProvinciaServicio(
        nombre="La Habana",
        activo=True
    )
    db.add(
        provincia
    )
    db.flush()
    punto = PuntoRecogida(
        nombre="Punto Smoke",
        direccion="La Habana",
        telefono="+5370000000",
        provincia_id=provincia.id,
        activo=True
    )
    paquete = PaqueteSaldo(
        nombre="Saldo Smoke",
        monto_pago=10,
        moneda_pago="BRL",
        saldo_cup=1000,
        activo=True
    )

    db.add_all([
        cliente,
        operador,
        metodo,
        oferta_transferencia,
        oferta_efectivo,
        punto,
        paquete,
    ])
    db.commit()

    contacto = Contacto(
        cliente_id=cliente.id,
        nombre="Beneficiario Smoke",
        telefono="+5312345678",
        numero_tarjeta="9222000011112222",
        tipo_tarjeta="MLC",
        documento_identidad_url="doc-smoke.jpg",
        pais="Cuba",
        activo=True
    )
    db.add(contacto)
    db.commit()

    return {
        "cliente": cliente,
        "contacto": contacto,
        "metodo": metodo,
        "operador": operador,
        "paquete": paquete,
        "punto": punto,
    }


def assert_pedido(db, respuesta, servicio, telefono_esperado=None):
    _assert(
        respuesta["pedido_id"],
        f"{servicio}: no devolvio pedido_id"
    )
    _assert(
        respuesta["estado"] == "pendiente_pago",
        f"{servicio}: estado inesperado"
    )
    _assert(
        "mensaje_operacion" in respuesta,
        f"{servicio}: no devolvio mensaje"
    )
    _assert(
        "{telefono}" not in respuesta["mensaje_operacion"],
        f"{servicio}: quedo variable telefono sin renderizar"
    )

    pedido = obtener_pedido_por_codigo(
        db,
        respuesta["codigo_operacion"]
    )
    detalle = pedido.get(
        "detalle"
    )

    _assert(
        pedido["servicio"] == servicio,
        f"{servicio}: servicio consultado incorrecto"
    )
    _assert(
        detalle is not None,
        f"{servicio}: no devolvio detalle"
    )

    if telefono_esperado is not None:
        _assert(
            detalle.get("telefono_destinatario") == telefono_esperado,
            (
                f"{servicio}: telefono_destinatario inesperado "
                f"{detalle.get('telefono_destinatario')!r}"
            )
        )

    return pedido


def run():
    db_path, db = crear_db_temporal()

    try:
        datos = sembrar_datos(
            db
        )

        transferencia = crear_pedido_transferencia(
            db,
            PedidoTransferenciaCreate(
                monto_pago=230,
                moneda_pago="BRL",
                numero_tarjeta="9222000011112222",
                telefono_destinatario="12345678",
                tipo_pago_id=datos["metodo"].id,
                operador_id=datos["operador"].id,
                cliente_id=0,
                nombre_cliente="Cliente Smoke Nuevo",
                numero_telefono_cliente="9595959595"
            )
        )
        pedido_transferencia = assert_pedido(
            db,
            transferencia,
            "transferencia",
            "+5312345678"
        )
        _assert(
            "operacion exitosa" in (
                pedido_transferencia.get(
                    "mensaje_finalizacion_sin_comprobante"
                )
                or ""
            ).lower(),
            "finalizacion: no devolvio el template predeterminado"
        )
        archivo = registrar_archivo_pedido(
            db,
            transferencia["codigo_operacion"],
            ArchivoPedidoCreate(
                tipo="comprobante_cliente",
                ruta_archivo="comprobantes/smoke-transferencia.jpg",
                nombre_archivo="smoke-transferencia.jpg",
                mime_type="image/jpeg",
                usuario="smoke"
            )
        )
        _assert(
            archivo["tipo"] == "comprobante_cliente",
            "archivo: tipo inesperado"
        )
        archivos = listar_archivos_pedido(
            db,
            transferencia["codigo_operacion"]
        )
        _assert(
            len(archivos) == 1,
            "archivo: no se listo el comprobante registrado"
        )
        pedido_transferencia = obtener_pedido_por_codigo(
            db,
            transferencia["codigo_operacion"]
        )
        _assert(
            pedido_transferencia.get("comprobante_pago") == "comprobantes/smoke-transferencia.jpg",
            "archivo: comprobante_cliente no actualizo comprobante_pago"
        )
        _assert(
            len(pedido_transferencia.get("archivos", [])) == 1,
            "archivo: obtener_pedido_por_codigo no incluye archivos"
        )
        actualizar_estado_pedido(
            db,
            transferencia["codigo_operacion"],
            "pago_confirmado"
        )
        actualizar_estado_pedido(
            db,
            transferencia["codigo_operacion"],
            "en_operacion"
        )
        try:
            actualizar_estado_pedido(
                db,
                transferencia["codigo_operacion"],
                "completado"
            )
            raise AssertionError(
                "finalizacion: permitio completar sin comprobante ni excepcion"
            )
        except Exception as exc:
            _assert(
                "comprobante de exito" in str(exc),
                "finalizacion: error inesperado sin comprobante"
            )

        registrar_archivo_pedido(
            db,
            transferencia["codigo_operacion"],
            ArchivoPedidoCreate(
                tipo="comprobante_final",
                ruta_archivo="comprobantes/smoke-final.jpg",
                nombre_archivo="smoke-final.jpg",
                mime_type="image/jpeg",
                usuario="smoke"
            )
        )
        transferencia_completada = actualizar_estado_pedido(
            db,
            transferencia["codigo_operacion"],
            "completado"
        )
        _assert(
            transferencia_completada["estado"] == "completado",
            "finalizacion: no completo con comprobante final"
        )

        efectivo = crear_pedido_efectivo(
            db,
            PedidoEfectivoCreate(
                monto_pago=100,
                moneda_pago="BRL",
                tipo_pago_id=datos["metodo"].id,
                operador_id=datos["operador"].id,
                cliente_id=datos["cliente"].id,
                contacto_id=datos["contacto"].id,
                punto_recogida_id=datos["punto"].id
            )
        )
        pedido_efectivo = assert_pedido(
            db,
            efectivo,
            "efectivo",
            "+5312345678"
        )
        _assert(
            pedido_efectivo["detalle"].get("documento_identidad_url") == "doc-smoke.jpg",
            "efectivo: no copio documento_identidad_url desde contacto"
        )

        saldo = crear_pedido_saldo(
            db,
            PedidoSaldoCreate(
                contacto_id=datos["contacto"].id,
                tipo_pago_id=datos["metodo"].id,
                operador_id=datos["operador"].id,
                cliente_id=datos["cliente"].id,
                paquete_saldo_id=datos["paquete"].id
            )
        )
        pedido_saldo = assert_pedido(
            db,
            saldo,
            "saldo",
            "+5312345678"
        )
        registrar_archivo_pedido(
            db,
            saldo["codigo_operacion"],
            ArchivoPedidoCreate(
                tipo="comprobante_cliente",
                ruta_archivo="comprobantes/smoke-saldo-pago.jpg",
                nombre_archivo="smoke-saldo-pago.jpg",
                mime_type="image/jpeg",
                usuario="smoke"
            )
        )
        actualizar_estado_pedido(
            db,
            saldo["codigo_operacion"],
            "pago_confirmado"
        )
        actualizar_estado_pedido(
            db,
            saldo["codigo_operacion"],
            "en_operacion"
        )
        saldo_completado = actualizar_estado_pedido(
            db,
            saldo["codigo_operacion"],
            "completado",
            finalizar_sin_comprobante=True,
            motivo_sin_comprobante=(
                "El proveedor no permitio descargar la confirmacion por problemas de conexion."
            )
        )
        _assert(
            saldo_completado["estado"] == "completado",
            "finalizacion: no completo con excepcion justificada"
        )
        _assert(
            "Operacion finalizada sin comprobante:" in (
                saldo_completado.get("observaciones")
                or ""
            ),
            "finalizacion: no guardo la explicacion en observaciones"
        )
        _assert(
            any(
                "Operacion finalizada sin comprobante:" in (
                    item.get("comentario")
                    or ""
                )
                for item in saldo_completado.get(
                    "historial",
                    []
                )
            ),
            "finalizacion: no guardo la explicacion en historial"
        )

        divisa = crear_pedido_divisa(
            db,
            PedidoDivisaCreate(
                monto_pago=50,
                moneda_pago="BRL",
                tipo_tarjeta=None,
                numero_tarjeta=None,
                telefono_destinatario=None,
                contacto_id=datos["contacto"].id,
                monto_divisa=45,
                tipo_pago_id=datos["metodo"].id,
                operador_id=datos["operador"].id,
                cliente_id=datos["cliente"].id
            )
        )
        pedido_divisa = assert_pedido(
            db,
            divisa,
            "divisa",
            "+5312345678"
        )
        _assert(
            pedido_divisa["detalle"].get("tipo_tarjeta") == "MLC",
            "divisa: no copio tipo_tarjeta desde contacto"
        )
        _assert(
            pedido_divisa["detalle"].get("numero_tarjeta") == "9222000011112222",
            "divisa: no copio numero_tarjeta desde contacto"
        )

        print(
            "OK: smoke de pedidos completado"
        )

    finally:
        db.close()
        Path(db_path).unlink(
            missing_ok=True
        )


if __name__ == "__main__":
    run()
