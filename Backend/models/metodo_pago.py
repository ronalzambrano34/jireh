from sqlalchemy import (
    Boolean
)
from sqlalchemy import (
    Column
)
from sqlalchemy import (
    Integer
)
from sqlalchemy import (
    String
)

from Backend.database import (
    Base
)


class MetodoPago(
    Base
):

    __tablename__ = (
        "metodos_pago"
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    nombre = Column(
        String,
        nullable=False,
        index=True
    )

    moneda = Column(
        String,
        nullable=False,
        index=True
    )

    activo = Column(
        Boolean,
        default=True
    )