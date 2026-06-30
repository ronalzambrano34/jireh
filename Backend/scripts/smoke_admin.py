import asyncio
from io import BytesIO
import json
from pathlib import Path
import sys
import tempfile
import time

from fastapi import FastAPI
from fastapi import UploadFile
from fastapi import HTTPException
from starlette.datastructures import Headers
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from Backend.database import Base
from Backend.database import get_db
from Backend.config import STORAGE_DIR
from Backend.config import UPLOAD_MAX_BYTES

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

from Backend.routes.operador import router as operador_router
from Backend.routes.reporte import router as reporte_router
from Backend.schemas.oferta import OfertaCreate, OfertaUpdate
from Backend.schemas.operador import OperadorCreate
from Backend.schemas.paquete_saldo import PaqueteSaldoCreate, PaqueteSaldoUpdate
from Backend.schemas.punto_recogida import PuntoRecogidaCreate
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
from Backend.services.operador_service import crear_operador
from Backend.services.paquete_saldo_service import (
    actualizar_paquete_saldo,
    crear_paquete_saldo,
    eliminar_paquete_saldo,
    listar_paquetes_saldo
)
from Backend.services.punto_recogida_service import (
    crear_punto_recogida,
    listar_puntos_recogida
)
from Backend.services.reporte_service import reporte_general
from Backend.services.auth_service import _b64encode
from Backend.services.auth_service import _firmar
from Backend.services.auth_service import crear_token_operador
from Backend.services.auth_service import hash_password
from Backend.services.auth_service import require_any_permission
from Backend.services.auth_service import require_permission


def _assert(condition, message):
    if not condition:
        raise AssertionError(message)


def _assert_forbidden(action, message):
    try:
        action()
    except HTTPException as exc:
        _assert(
            exc.status_code == 403,
            message
        )
        return
    raise AssertionError(message)


def _assert_error(action, texto_esperado, message):
    try:
        action()
    except Exception as exc:
        _assert(
            texto_esperado in str(exc),
            message
        )
        return
    raise AssertionError(message)


def _assert_response(response, status_code, detail, message):
    _assert(
        response.status_code == status_code,
        message
    )
    _assert(
        response.json().get("detail") == detail,
        message
    )


class SmokeResponse:
    def __init__(
        self,
        status_code,
        content
    ):
        self.status_code = status_code
        self.content = content

    def json(self):
        return json.loads(
            self.content.decode(
                "utf-8"
            )
            or "{}"
        )


async def _request_asgi_async(
    app,
    method,
    path,
    headers=None,
    json_body=None
):
    body = b""
    request_headers = [
        (
            b"host",
            b"testserver"
        )
    ]

    if json_body is not None:
        body = json.dumps(
            json_body
        ).encode(
            "utf-8"
        )
        request_headers.append(
            (
                b"content-type",
                b"application/json"
            )
        )

    for key, value in (headers or {}).items():
        request_headers.append(
            (
                key.lower().encode(
                    "latin-1"
                ),
                value.encode(
                    "latin-1"
                )
            )
        )

    response_status = 500
    response_body = []
    request_sent = False

    async def receive():
        nonlocal request_sent
        if request_sent:
            return {
                "type": "http.request",
                "body": b"",
                "more_body": False
            }
        request_sent = True
        return {
            "type": "http.request",
            "body": body,
            "more_body": False
        }

    async def send(message):
        nonlocal response_status
        if message["type"] == "http.response.start":
            response_status = message["status"]
        if message["type"] == "http.response.body":
            response_body.append(
                message.get(
                    "body",
                    b""
                )
            )

    await app(
        {
            "type": "http",
            "asgi": {
                "version": "3.0"
            },
            "http_version": "1.1",
            "method": method.upper(),
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(
                "ascii"
            ),
            "query_string": b"",
            "headers": request_headers,
            "client": (
                "testclient",
                50000
            ),
            "server": (
                "testserver",
                80
            )
        },
        receive,
        send
    )
    return SmokeResponse(
        response_status,
        b"".join(
            response_body
        )
    )


def request_asgi(
    app,
    method,
    path,
    headers=None,
    json_body=None
):
    return asyncio.run(
        _request_asgi_async(
            app,
            method,
            path,
            headers=headers,
            json_body=json_body
        )
    )


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


def crear_token_expirado(operador):
    payload = {
        "sub": operador.id,
        "rol": operador.rol,
        "exp": int(time.time()) - 60
    }
    payload_b64 = _b64encode(
        json.dumps(
            payload,
            separators=(
                ",",
                ":"
            )
        ).encode(
            "utf-8"
        )
    )
    return (
        payload_b64
        + "."
        + _firmar(
            payload_b64
        )
    )


def probar_endpoints_protegidos():
    tmp = tempfile.NamedTemporaryFile(
        suffix=".sqlite",
        delete=False
    )
    tmp.close()
    engine = create_engine(
        f"sqlite:///{tmp.name}",
        connect_args={
            "check_same_thread": False
        }
    )
    Base.metadata.create_all(
        bind=engine
    )
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
    db = SessionLocal()
    try:
        admin = Operador(
            nombre="Admin Auth Smoke",
            codigo_operador="AHS",
            telefono="+5355533333",
            rol="admin",
            password_hash=hash_password(
                "secreto1"
            )
        )
        consultor = Operador(
            nombre="Consultor Auth Smoke",
            codigo_operador="CHS",
            telefono="+5355544444",
            rol="consultor",
            password_hash=hash_password(
                "secreto1"
            )
        )
        db.add_all([
            admin,
            consultor
        ])
        db.commit()
        db.refresh(
            admin
        )
        db.refresh(
            consultor
        )
        token_expirado = crear_token_expirado(
            admin
        )
        token_consultor = crear_token_operador(
            consultor
        )
    finally:
        db.close()

    app = FastAPI()
    app.include_router(
        reporte_router
    )
    app.include_router(
        operador_router
    )

    def override_db():
        request_db = SessionLocal()
        try:
            yield request_db
        finally:
            request_db.close()

    app.dependency_overrides[get_db] = override_db

    try:
        _assert_response(
            request_asgi(
                app,
                "GET",
                "/reportes/resumen"
            ),
            401,
            "Token requerido",
            "auth: endpoint protegido permitio acceso sin token"
        )
        _assert_response(
            request_asgi(
                app,
                "GET",
                "/reportes/resumen",
                headers={
                    "Authorization": f"Bearer {token_expirado}"
                }
            ),
            401,
            "Token expirado",
            "auth: endpoint protegido permitio token vencido"
        )
        _assert_response(
            request_asgi(
                app,
                "POST",
                "/operador/",
                headers={
                    "Authorization": f"Bearer {token_consultor}"
                },
                json_body={
                    "nombre": "Operador Sin Permiso",
                    "telefono": "+5355555555",
                    "password": "secreto1",
                    "rol": "operador"
                }
            ),
            403,
            "Permiso insuficiente",
            "auth: endpoint protegido permitio permiso insuficiente"
        )
    finally:
        app.dependency_overrides.clear()
        Path(
            tmp.name
        ).unlink(
            missing_ok=True
        )


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
    probar_endpoints_protegidos()

    _db_path, db = crear_db_temporal()

    try:
        operador, cliente, metodo = sembrar_base(
            db
        )
        consultor_rol = Operador(
            nombre="Consultor Smoke",
            codigo_operador="CS",
            rol="consultor"
        )
        operador_rol = Operador(
            nombre="Operador Smoke",
            codigo_operador="OS",
            rol="operador"
        )
        admin_rol = Operador(
            nombre="Admin Permisos Smoke",
            codigo_operador="APS",
            rol="admin"
        )
        reportero = Operador(
            nombre="Reportero Smoke",
            codigo_operador="RS",
            rol="consultor",
            permisos_config='["reportes:ver"]'
        )
        consultor_permisos = consultor_rol.permisos
        operador_permisos = operador_rol.permisos
        admin_permisos = admin_rol.permisos
        _assert(
            consultor_permisos == [
                "pedidos:ver",
                "clientes:ver",
                "contactos:ver"
            ],
            "roles: consultor debe ser solo lectura"
        )
        _assert(
            "pedidos:crear" in operador_permisos
            and "pedidos:gestionar" in operador_permisos
            and "reportes:ver" in operador_permisos
            and "empresa:control_total" not in operador_permisos,
            "roles: operador debe crear/gestionar pedidos y ver reportes sin control total"
        )
        _assert(
            "empresa:control_total" in admin_permisos
            and "reportes:ver" in admin_permisos,
            "roles: admin debe tener control total y reportes"
        )
        _assert_forbidden(
            lambda: require_permission("empresa:control_total")(consultor_rol),
            "permisos: consultor no debe ejecutar Admin"
        )
        _assert(
            require_any_permission([
                "reportes:ver",
                "pedidos:gestionar",
                "empresa:control_total"
            ])(reportero) is reportero,
            "permisos: reportes:ver debe permitir lectura de Reportes"
        )
        _assert_forbidden(
            lambda: require_permission("pedidos:gestionar")(reportero),
            "permisos: reportes:ver no debe registrar extracciones ni gestionar pedidos"
        )
        _assert_error(
            lambda: crear_operador(
                db,
                OperadorCreate(
                    nombre="Sin Password Smoke",
                    telefono="+5355522222",
                    password=" ",
                    rol="operador"
                )
            ),
            "contraseña inicial es obligatoria",
            "operadores: permitio crear operador sin contraseña"
        )

        provincia_activa = ProvinciaServicio(
            nombre="Santiago Smoke",
            activo=True
        )
        provincia_inactiva = ProvinciaServicio(
            nombre="Habana Smoke",
            activo=False
        )
        db.add_all([
            provincia_activa,
            provincia_inactiva
        ])
        db.commit()
        punto_activo = crear_punto_recogida(
            db,
            PuntoRecogidaCreate(
                nombre="Punto activo",
                direccion="Direccion activa",
                provincia_id=provincia_activa.id
            )
        )
        punto_provincia_inactiva = PuntoRecogida(
            nombre="Punto oculto",
            direccion="Direccion oculta",
            provincia_id=provincia_inactiva.id,
            activo=True
        )
        db.add(
            punto_provincia_inactiva
        )
        db.commit()
        _assert_error(
            lambda: crear_punto_recogida(
                db,
                PuntoRecogidaCreate(
                    nombre="Punto invalido",
                    direccion="Direccion invalida",
                    provincia_id=provincia_inactiva.id
                )
            ),
            "provincia seleccionada esta inactiva",
            "puntos: permitio crear punto en provincia inactiva"
        )
        puntos_operativos = listar_puntos_recogida(
            db
        )
        _assert(
            punto_activo.id in [punto.id for punto in puntos_operativos],
            "puntos: no muestra punto con provincia activa"
        )
        _assert(
            punto_provincia_inactiva.id not in [punto.id for punto in puntos_operativos],
            "puntos: muestra punto de provincia inactiva"
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
        upload_repetido = UploadFile(
            file=BytesIO(
                b"abc123"
            ),
            filename="comprobante.jpg"
        )
        archivo_repetido = guardar_upload_pedido(
            db,
            "JH-SMOKE-UPLOAD",
            "comprobante_cliente",
            upload_repetido,
            usuario="smoke",
            notas="ok"
        )
        _assert(
            archivo["tipo"] == "comprobante_cliente",
            "archivo: tipo inesperado"
        )
        _assert(
            archivo_repetido["id"] == archivo["id"],
            "archivo: doble upload no reutilizo el archivo existente"
        )
        ruta_upload = archivo["ruta_archivo"]
        ruta_upload_local = (
            STORAGE_DIR / ruta_upload.removeprefix("/storage/")
            if ruta_upload.startswith("/storage/")
            else Path(ruta_upload)
        )
        _assert(
            ruta_upload.startswith("http")
            or ruta_upload_local.exists(),
            "archivo: upload no creo archivo local"
        )
        _assert(
            len(listar_archivos_pedido(db, "JH-SMOKE-UPLOAD")) == 1,
            "archivo: doble upload duplico evidencias"
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
        _assert_error(
            lambda: guardar_upload_pedido(
                db,
                "JH-SMOKE-UPLOAD",
                "comprobante_cliente",
                UploadFile(
                    file=BytesIO(
                        b"no permitido"
                    ),
                    filename="comprobante.txt",
                    headers=Headers(
                        {
                            "content-type": "text/plain"
                        }
                    )
                ),
                usuario="smoke",
                notas="mime invalido"
            ),
            "Tipo de archivo no permitido",
            "archivo: permitio MIME no permitido"
        )
        _assert_error(
            lambda: guardar_upload_pedido(
                db,
                "JH-SMOKE-UPLOAD",
                "comprobante_cliente",
                UploadFile(
                    file=BytesIO(
                        b"x" * (UPLOAD_MAX_BYTES + 1)
                    ),
                    filename="comprobante-grande.jpg",
                    headers=Headers(
                        {
                            "content-type": "image/jpeg"
                        }
                    )
                ),
                usuario="smoke",
                notas="archivo grande"
            ),
            "Archivo excede el tamano maximo permitido",
            "archivo: permitio archivo sobre limite"
        )
        _assert(
            len(listar_archivos_pedido(db, "JH-SMOKE-UPLOAD")) == 1,
            "archivo: MIME invalido o archivo grande dejo evidencia"
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
