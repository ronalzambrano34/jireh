from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from Backend.routes.webhook import router as webhook_router

from Backend.config import FRONTEND_ORIGINS
from Backend.config import IS_VERCEL
from Backend.config import RUN_DB_BOOTSTRAP
from Backend.config import RUN_DB_MAINTENANCE
from Backend.config import STORAGE_DIR

from Backend.database import Base
from Backend.database import engine
from Backend.database import SessionLocal

from Backend.models.cliente import Cliente
from Backend.models.configuracion import Configuracion
from Backend.models.operador import Operador
from Backend.models.metodo_pago import MetodoPago
from Backend.models.metodo_pago_cuenta import MetodoPagoCuenta
from Backend.models.extraccion_cuenta import ExtraccionCuenta
from Backend.models.punto_recogida import PuntoRecogida
from Backend.models.provincia_servicio import ProvinciaServicio
from Backend.models.oferta import Oferta
from Backend.models.pedido import Pedido
from Backend.models.contacto import Contacto
from Backend.models.archivo_pedido import ArchivoPedido
from Backend.models.promocion import Promocion

from Backend.models.pedido_transferencia import (PedidoTransferencia)
from Backend.models.pedido_saldo import (PedidoSaldo)
from Backend.models.pedido_efectivo import (PedidoEfectivo)
from Backend.models.pedido_divisa import (PedidoDivisa)
from Backend.models.pedido_otros import PedidoOtros

from Backend.routes.pedido import (router as pedido_router)
from Backend.routes.operador import (router as operador_router)
from Backend.routes.pedido_efectivo import (router as efectivo_router)
from Backend.routes.pedido_saldo import (router as saldo_router)
from Backend.routes.pedido_divisa import (router as divisa_router)
from Backend.routes.configuracion import (router as configuracion_router)
from Backend.routes.calculadora import (router as calculadora_router)
from Backend.routes.contacto import (router as contacto_router)
from Backend.routes.cliente import (router as cliente_router)
from Backend.routes.auth import (router as auth_router)
from Backend.routes.reporte import (router as reporte_router)
from Backend.routes.paquete_saldo import (router as paquete_saldo_router)
from Backend.routes.oferta import (router as oferta_router)
from Backend.routes.archivo_pedido import (router as archivo_pedido_router)
from Backend.routes.promocion import (router as promocion_router)


from Backend.routes.metodo_pago import (router as metodo_pago_router)
from Backend.routes.punto_recogida import (router as punto_recogida_router)
from Backend.routes.provincia_servicio import (router as provincia_servicio_router)
from Backend.routes.sync import (router as sync_router)
from Backend.routes.tasa_operativa import (router as tasa_operativa_router)

from Backend.services.db_maintenance import ensure_runtime_columns
from Backend.services.seed_admin import seed_admin_operador
from Backend.services.seed_admin import seed_cliente_generico
from Backend.services.seed_admin import seed_test_admin_operador
from Backend.services.seed_metodos_pago import (seed_metodos_pago)
from Backend.services.promocion_service import asegurar_slides_carrusel_default
from Backend.services.provincia_servicio_service import seed_provincias_servicio
from Backend.services.oferta_sync_control import detener_scheduler_sync_ofertas
from Backend.services.oferta_sync_control import iniciar_scheduler_sync_ofertas
from Backend.routes.template import (router as template_router)

app = FastAPI()

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if RUN_DB_BOOTSTRAP:
    Base.metadata.create_all(
        bind=engine
    )

    _db = SessionLocal()
    try:
        if RUN_DB_MAINTENANCE:
            ensure_runtime_columns(
                _db
            )
        seed_cliente_generico(
            _db
        )
        seed_admin_operador(
            _db
        )
        seed_test_admin_operador(
            _db
        )
        seed_metodos_pago(
            _db
        )
        seed_provincias_servicio(
            _db
        )
        asegurar_slides_carrusel_default(
            _db
        )
    finally:
        _db.close()

app.include_router(pedido_router)
app.include_router(operador_router)
app.include_router(efectivo_router)
app.include_router(saldo_router)
app.include_router(divisa_router)
app.include_router(configuracion_router)
app.include_router(webhook_router)
app.include_router(calculadora_router)
app.include_router(contacto_router)
app.include_router(cliente_router)
app.include_router(auth_router)
app.include_router(reporte_router)
app.include_router(paquete_saldo_router)
app.include_router(oferta_router)
app.include_router(archivo_pedido_router)
app.include_router(promocion_router)
app.include_router(template_router)

app.include_router(metodo_pago_router)
app.include_router(punto_recogida_router)
app.include_router(provincia_servicio_router)
app.include_router(sync_router)
app.include_router(tasa_operativa_router)

@app.on_event("startup")
def startup_ofertas_sync():
    if IS_VERCEL:
        return

    iniciar_scheduler_sync_ofertas(
        SessionLocal
    )


@app.on_event("shutdown")
def shutdown_ofertas_sync():
    detener_scheduler_sync_ofertas()



@app.get("/")
def home():

    return {
        "message": "Jireh API",
        "environment": "vercel" if IS_VERCEL else "server"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }
