"""
Servicio para normalizar y validar números de teléfono por país.

Códigos de país:
- Brasil: +55
- Uruguay: +598
- Cuba: +53
"""

CODIGOS_PAIS = {
    "brl": "+55",
    "uyu": "+598",
    "cup": "+53",
    "BRL": "+55",
    "UYU": "+598",
    "CUP": "+53",
    "br": "+55",
    "uy": "+598",
    "cu": "+53"
}

PAISES = {
    "br": "Brasil",
    "uy": "Uruguay",
    "cu": "Cuba",
    "+55": "Brasil",
    "+598": "Uruguay",
    "+53": "Cuba"
}

PAIS_DEFECTO = "br"
CODIGO_DEFECTO = "+55"


def _solo_digitos(numero: str) -> str:
    return "".join(ch for ch in numero if ch.isdigit())


def _digitos_codigo(codigo: str) -> str:
    return _solo_digitos(codigo)


def _quitar_prefijo_internacional(numero: str) -> str:
    return numero[2:] if numero.startswith("00") else numero


def _detectar_codigo(numero: str) -> str | None:
    digitos = _quitar_prefijo_internacional(_solo_digitos(numero))
    codigos = sorted(
        set(CODIGOS_PAIS.values()),
        key=len,
        reverse=True
    )

    for codigo in codigos:
        if digitos.startswith(_digitos_codigo(codigo)):
            return codigo

    return None


def _quitar_codigo_repetido(numero: str, codigo: str) -> str:
    prefijo = _digitos_codigo(codigo)
    return (
        numero[len(prefijo):]
        if numero.startswith(prefijo)
        else numero
    )


def _normalizar_local_por_pais(codigo: str, local: str) -> str:
    if codigo not in {"+55", "+598"}:
        while local.startswith("0") and len(local) > 8:
            local = local[1:]

    if codigo == "+55":
        while local.startswith("0") and len(local) > 10:
            local = local[1:]

        ddd = local[:2]
        abonado = local[2:]
        if (
            len(ddd) == 2
            and len(abonado) == 8
            and abonado[0:1] in {"6", "7", "8", "9"}
        ):
            local = f"{ddd}9{abonado}"

    if codigo == "+598" and len(local) > 8:
        local = local[-8:]

    return local


def normalizar_telefono(
    numero: str,
    pais: str = PAIS_DEFECTO
) -> str:
    """
    Normaliza un número de teléfono agregando código de país.

    Args:
        numero: Número de teléfono (con o sin código)
        pais: Código de país ISO 2 (br, uy, cu) o moneda (BRL, UYU, CUP)

    Returns:
        Número normalizado con código de país

    Ejemplos:
        normalizar_telefono("11987654321", "br") -> "+5511987654321"
        normalizar_telefono("+55987654321") -> "+5587654321"
        normalizar_telefono("92123456", "cu") -> "+5392123456"
    """

    if not numero:
        raise ValueError(
            "El número de teléfono no puede estar vacío"
        )

    texto = str(numero).strip()
    digitos_originales = _solo_digitos(texto)
    codigo_explicito = (
        texto.startswith("+")
        or digitos_originales.startswith("00")
    )
    codigo = (
        _detectar_codigo(texto)
        if codigo_explicito
        else None
    ) or CODIGOS_PAIS.get(
        pais.lower(),
        CODIGO_DEFECTO
    )
    digitos = _quitar_prefijo_internacional(digitos_originales)
    local_sin_codigo = (
        _quitar_codigo_repetido(digitos, codigo)
        if codigo_explicito
        else digitos
    )
    local = _normalizar_local_por_pais(
        codigo,
        local_sin_codigo
    )

    return f"{codigo}{local}" if local else codigo


def obtener_codigo_pais(
    pais: str
) -> str:
    """
    Obtiene el código telefónico de un país.

    Args:
        pais: Código ISO 2 (br, uy, cu) o moneda (BRL, UYU, CUP)

    Returns:
        Código de país (+55, +598, +53)
    """

    return CODIGOS_PAIS.get(
        pais.lower(),
        CODIGO_DEFECTO
    )


def obtener_nombre_pais(
    codigo_o_pais: str
) -> str:
    """
    Obtiene el nombre del país.

    Args:
        codigo_o_pais: Código ISO (br, uy, cu) o código telefónico (+55, +598, +53)

    Returns:
        Nombre del país
    """

    return PAISES.get(
        codigo_o_pais.lower(),
        "Desconocido"
    )


def detectar_pais_por_codigo_telefono(
    numero: str
) -> str:
    """
    Detecta el país basado en el código telefónico.

    Args:
        numero: Número de teléfono (preferiblemente con código)

    Returns:
        Código de país ISO 2 (br, uy, cu)
    """

    numero = "+" + _quitar_prefijo_internacional(_solo_digitos(numero))

    if numero.startswith("+55"):
        return "br"
    elif numero.startswith("+598"):
        return "uy"
    elif numero.startswith("+53"):
        return "cu"
    else:
        return PAIS_DEFECTO
