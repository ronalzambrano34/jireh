from database import engine
from database import Base

Base.metadata.create_all(bind=engine)