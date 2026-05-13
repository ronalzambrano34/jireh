from database import Base, engine
from models import pedido

Base.metadata.create_all(bind=engine)