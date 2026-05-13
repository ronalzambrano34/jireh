def responder(
    texto
):

    texto = texto.lower()

    if "hola" in texto:
        return (
            "👋 Hola\n\n"
            "Bienvenido "
            "a CubaLink "
            "Express 🇨🇺\n\n"
            "Escribe:\n"
            "📶 recarga\n"
            "💵 remesa"
        )

    if "recarga" in texto:
        return (
            "📶 RECARGAS\n\n"
            "25 BRL ➜ 360\n"
            "60 BRL ➜ 800\n"
            "75 BRL ➜ 1000\n\n"
            "Envíame número "
            "y monto"
        )

    if "remesa" in texto:
        return (
            "💵 REMESAS\n\n"
            "MLC o CUP\n\n"
            "Indica monto"
        )

    return (
        "No entendí.\n"
        "Escribe:\n"
        "recarga o remesa"
    )