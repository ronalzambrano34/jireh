import requests

from config import TOKEN
from config import PHONE_ID


def enviar_mensaje(
    numero,
    mensaje
):

    url = (
        f"https://graph.facebook.com/"
        f"v18.0/"
        f"{PHONE_ID}/messages"
    )

    headers = {
        "Authorization":
        f"Bearer {TOKEN}",

        "Content-Type":
        "application/json"
    }

    data = {
        "messaging_product":
        "whatsapp",

        "to":
        numero,

        "type":
        "text",

        "text": {
            "body":
            mensaje
        }
    }

    requests.post(
        url,
        headers=headers,
        json=data
    )