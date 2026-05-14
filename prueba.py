from services.generador_codigo import (
    generar_codigo_operacion
)

codigo = generar_codigo_operacion(
    "XR",
    "transferencia"
)

print(codigo)