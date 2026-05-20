MONEDAS_PERMITIDAS = {
    "BRL",
    "UYU",
    "USD",
    "EUR",
}

MONEDAS_ALIASES = {
    "R$": "BRL",
    "REAL": "BRL",
    "REAIS": "BRL",
    "BRASIL": "BRL",
    "PESO URUGUAYO": "UYU",
    "PESOS URUGUAYOS": "UYU",
    "URUGUAY": "UYU",
    "UY": "UYU",
    "$U": "UYU",
    "DOLAR": "USD",
    "DOLARES": "USD",
    "DOLLAR": "USD",
    "DOLLARS": "USD",
    "EURO": "EUR",
    "EUROS": "EUR",
}


def normalizar_moneda(
    value,
    default="BRL"
):
    if value is None:
        return default

    moneda = (
        str(value)
        .strip()
        .upper()
    )

    if not moneda:
        return default

    if moneda in MONEDAS_PERMITIDAS:
        return moneda

    for codigo in MONEDAS_PERMITIDAS:
        if codigo in moneda:
            return codigo

    if moneda in MONEDAS_ALIASES:
        return MONEDAS_ALIASES[
            moneda
        ]

    for alias, codigo in MONEDAS_ALIASES.items():
        permite_busqueda_parcial = (
            len(alias) > 2
            or not alias.isalpha()
        )

        if permite_busqueda_parcial and alias in moneda:
            return codigo

    return default
