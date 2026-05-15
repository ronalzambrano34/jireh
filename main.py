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

from models.pedido_transferencia import (PedidoTransferencia)
from models.pedido_saldo import (PedidoSaldo)
from models.pedido_efectivo import (PedidoEfectivo)
from models.pedido_divisa import (PedidoDivisa)

from routes.pedido import (router as pedido_router)
from routes.operador import (router as operador_router)
from routes.pedido_efectivo import (router as efectivo_router)
from routes.pedido_saldo import (router as saldo_router)
from routes.configuracion import (router as configuracion_router)


from routes.sync import (router as sync_router)
from services.db_maintenance import ensure_runtime_columns


app = FastAPI()


Base.metadata.create_all(
    bind=engine
)

_db = SessionLocal()
try:
    ensure_runtime_columns(
        _db
    )
finally:
    _db.close()

app.include_router(pedido_router)
app.include_router(operador_router)
app.include_router(efectivo_router)
app.include_router(saldo_router)
app.include_router(configuracion_router)
app.include_router(webhook_router)

app.include_router(sync_router)


@app.get("/")
def home():

    return {
        "message": "Jireh API"
    }
