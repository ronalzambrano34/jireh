"""
Script para limpiar la tabla metodos_pago y remover constraint UNIQUE incorrecto.
Ejecutar con: python clean_metodos_pago.py
"""

from database import SessionLocal
from models.metodo_pago import MetodoPago
from sqlalchemy import text

def clean_metodos_pago():
    db = SessionLocal()
    try:
        # Eliminar todos los métodos de pago
        db.query(MetodoPago).delete()
        db.commit()
        print("✓ Tabla metodos_pago limpiada")
        
        # Intentar remover constraint UNIQUE si existe
        try:
            db.execute(
                text(
                    "ALTER TABLE metodos_pago DROP CONSTRAINT metodos_pago_nombre_key"
                )
            )
            db.commit()
            print("✓ Constraint UNIQUE removido de nombre")
        except Exception as e:
            print(f"⚠ No fue posible remover constraint (podría no existir): {str(e)}")
            db.rollback()
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_metodos_pago()
    print("\n✓ Limpieza completada. Puedes reiniciar la aplicación.")
