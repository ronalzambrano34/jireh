from fastapi import FastAPI

from routes.webhook import router as webhook_router

from database import Base
from database import engine
from database import SessionLocal

from models.cliente import Cliente
from models.configuracion import Configuracion
from models.operador import Operador
from models.metodo_pago import MetodoPago
from models.punto_recogida import PuntoRecogida
from models.oferta import Oferta
from models.pedido import Pedido
from models.contacto import Contacto
from models.archivo_pedido import ArchivoPedido

from models.pedido_transferencia import (PedidoTransferencia)
from models.pedido_saldo import (PedidoSaldo)
from models.pedido_efectivo import (PedidoEfectivo)
from models.pedido_divisa import (PedidoDivisa)

from routes.pedido import (router as pedido_router)
from routes.operador import (router as operador_router)
from routes.pedido_efectivo import (router as efectivo_router)
from routes.pedido_saldo import (router as saldo_router)
from routes.pedido_divisa import (router as divisa_router)
from routes.configuracion import (router as configuracion_router)
from routes.calculadora import (router as calculadora_router)
from routes.contacto import (router as contacto_router)
from routes.cliente import (router as cliente_router)
from routes.auth import (router as auth_router)
from routes.archivo_pedido import (router as archivo_pedido_router)


from routes.metodo_pago import (router as metodo_pago_router)
from routes.punto_recogida import (router as punto_recogida_router)
from routes.sync import (router as sync_router)

from services.db_maintenance import ensure_runtime_columns
from services.seed_admin import (seed_admin_cliente)
from services.seed_metodos_pago import (seed_metodos_pago)
from routes.template import (router as template_router)

app = FastAPI()


Base.metadata.create_all(
    bind=engine
)

_db = SessionLocal()
try:
    ensure_runtime_columns(
        _db
    )
    seed_admin_cliente(
        _db
    )
    seed_metodos_pago(
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
app.include_router(archivo_pedido_router)
app.include_router(template_router)

app.include_router(metodo_pago_router)
app.include_router(punto_recogida_router)
app.include_router(sync_router)


@app.get("/")
def home():

    return {
        "message": "Jireh API"
    }
