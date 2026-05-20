"""
Servicio para normalizar y validar números de teléfono por país.

Códigos de país:
- Brasil: +55
- Uruguay: +598
- Cuba: +53
"""

CODIGOS_PAIS = {
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

    # Limpiar espacios y caracteres especiales
    numero = (
        numero.replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
    )

    # Obtener código de país
    codigo = CODIGOS_PAIS.get(
        pais.lower(),
        CODIGO_DEFECTO
    )

    # Si ya tiene código de país, retornar
    if numero.startswith("+"):
        return numero

    # Si empieza con 0, removerlo (formato nacional)
    if numero.startswith("0"):
        numero = numero[1:]

    # Agregar código de país
    return f"{codigo}{numero}"


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

    numero = (
        numero.replace(" ", "")
        .replace("-", "")
    )

    if numero.startswith("+55"):
        return "br"
    elif numero.startswith("+598"):
        return "uy"
    elif numero.startswith("+53"):
        return "cu"
    else:
        return PAIS_DEFECTO
