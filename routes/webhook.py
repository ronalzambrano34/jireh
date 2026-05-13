from fastapi import APIRouter
from fastapi import Request

from services.whatsapp import enviar_mensaje
from services.pedidos import responder

router = APIRouter()


@router.post(
    "/webhook"
)
async def webhook(
    req: Request
):

    data = await req.json()

    try:

        entry = data["entry"][0]

        changes = (
            entry["changes"][0]
        )

        value = (
            changes["value"]
        )

        numero = (
            value["messages"][0]
            ["from"]
        )

        mensaje = (
            value["messages"][0]
            ["text"]["body"]
        )

        respuesta = responder(
            mensaje
        )

        enviar_mensaje(
            numero,
            respuesta
        )

        return {
            "ok": True
        }

    except Exception as e:

        print(e)

        return {
            "ok": False
        }