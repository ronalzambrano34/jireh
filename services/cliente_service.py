from sqlalchemy.orm import Session

from models.cliente import Cliente

from services.telefonos import (
    normalizar_telefono,
    obtener_nombre_pais,
    detectar_pais_por_codigo_telefono
)


def obtener_o_crear_cliente_por_telefono(
    db: Session,
    numero_telefono: str,
    nombre: str = None,
    pais: str = "br"
):
    """
    Busca un cliente por número de teléfono.
    Si no existe, crea uno nuevo.
    
    Args:
        db: Sesión de BD
        numero_telefono: Número de teléfono del cliente
        nombre: Nombre opcional para cliente nuevo
        pais: Código de país (br, uy, cu) o moneda (BRL, UYU, CUP)
    
    Returns:
        Cliente encontrado o creado
    """
    
    # Normalizar el teléfono
    telefono_normalizado = (
        normalizar_telefono(
            numero_telefono,
            pais
        )
    )
    
    # Detectar país del teléfono
    pais_detectado = (
        detectar_pais_por_codigo_telefono(
            telefono_normalizado
        )
    )
    
    cliente = (
        db.query(
            Cliente
        )
        .filter(
            Cliente.telefono
            == telefono_normalizado
        )
        .first()
    )
    
    if cliente:
        return cliente
    
    # Crear nuevo cliente
    nuevo_cliente = Cliente(
        nombre=(
            nombre
            or f"Cliente {telefono_normalizado}"
        ),
        telefono=telefono_normalizado,
        pais=obtener_nombre_pais(
            pais_detectado
        )
    )
    
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    
    return nuevo_cliente
