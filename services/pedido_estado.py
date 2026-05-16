class PedidoEstado:

    CREADO = "creado"

    PAGO_CONFIRMADO = (
        "pago_confirmado"
    )

    EN_OPERACION = (
        "en_operacion"
    )

    COMPLETADO = (
        "completado"
    )

    CANCELADO = (
        "cancelado"
    )

    ERROR = "error"

    TODOS = [
        CREADO,
        PAGO_CONFIRMADO,
        EN_OPERACION,
        COMPLETADO,
        CANCELADO,
        ERROR
    ]