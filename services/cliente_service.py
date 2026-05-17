from sqlalchemy.orm import Session

from models.cliente import Cliente


def obtener_o_crear_cliente_por_telefono(
    db: Session,
    numero_telefono: str,
    nombre: str = None
):
    """
    Busca un cliente por número de teléfono.
    Si no existe, crea uno nuevo.
    
    Args:
        db: Sesión de BD
        numero_telefono: Número de teléfono del cliente
        nombre: Nombre opcional para cliente nuevo
    
    Returns:
        Cliente encontrado o creado
    """
    
    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.telefono
            == numero_telefono
        )
        .first()
    )
    
    if cliente:
        return cliente
    
    # Crear nuevo cliente
    nuevo_cliente = Cliente(
        nombre=(
            nombre
            or f"Cliente {numero_telefono}"
        ),
        telefono=numero_telefono
    )
    
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    
    return nuevo_cliente
