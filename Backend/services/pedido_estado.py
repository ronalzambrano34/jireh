class PedidoEstado:

    CREADO = "creado"

    PENDIENTE_PAGO = (
        "pendiente_pago"
    )

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
        PENDIENTE_PAGO,
        PAGO_CONFIRMADO,
        EN_OPERACION,
        COMPLETADO,
        CANCELADO,
        ERROR
    ]
