from __future__ import annotations

from datetime import datetime
from datetime import timedelta
import threading

from sqlalchemy.orm import Session

from Backend.config import OFERTAS_AUTO_SYNC_ENABLED
from Backend.config import OFERTAS_SYNC_INTERVAL_HOURS
from Backend.config import OFERTAS_SYNC_START_DELAY_SECONDS
from Backend.models.configuracion import Configuracion
from Backend.services.google_sheet_sync import sync_ofertas


SYNC_LAST_SUCCESS_KEY = "ofertas_sync_last_success_at"
SYNC_LAST_ATTEMPT_KEY = "ofertas_sync_last_attempt_at"
SYNC_LAST_ERROR_KEY = "ofertas_sync_last_error"
SYNC_RUNNING_KEY = "ofertas_sync_running"

_scheduler_started = False
_scheduler_stop = threading.Event()


def _utcnow():
    return datetime.utcnow().replace(microsecond=0)


def _iso(value: datetime):
    return value.isoformat()


def _parse_datetime(value: str | None):
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _get_config(db: Session, clave: str):
    return (
        db.query(Configuracion)
        .filter(Configuracion.clave == clave)
        .first()
    )


def _get_value(db: Session, clave: str, default: str = ""):
    config = _get_config(db, clave)
    return config.valor if config else default


def _set_value(db: Session, clave: str, valor: str, editable: bool = False, descripcion: str | None = None):
    config = _get_config(db, clave)
    if config:
        config.valor = valor
        config.editable = editable
        if descripcion is not None:
            config.descripcion = descripcion
        return config

    config = Configuracion(
        clave=clave,
        valor=valor,
        editable=editable,
        descripcion=descripcion,
    )
    db.add(config)
    return config


def obtener_estado_sync_ofertas(db: Session):
    interval_hours = max(float(OFERTAS_SYNC_INTERVAL_HOURS or 12), 0.25)
    last_success = _parse_datetime(_get_value(db, SYNC_LAST_SUCCESS_KEY))
    last_attempt = _parse_datetime(_get_value(db, SYNC_LAST_ATTEMPT_KEY))
    now = _utcnow()
    next_sync = last_success + timedelta(hours=interval_hours) if last_success else None
    stale = next_sync is None or now >= next_sync

    return {
        "interval_hours": interval_hours,
        "last_success_at": _iso(last_success) if last_success else None,
        "last_attempt_at": _iso(last_attempt) if last_attempt else None,
        "next_sync_at": _iso(next_sync) if next_sync else None,
        "stale": stale,
        "running": _get_value(db, SYNC_RUNNING_KEY, "false") == "true",
        "last_error": _get_value(db, SYNC_LAST_ERROR_KEY, "") or None,
    }


def sincronizar_ofertas_cacheadas(db: Session, force: bool = False):
    estado = obtener_estado_sync_ofertas(db)
    if not force and not estado["stale"]:
        return {
            "skipped": True,
            "reason": "cache_vigente",
            "meta": {
                "sincronizacion": estado,
            },
        }

    intento = _utcnow()
    _set_value(db, SYNC_LAST_ATTEMPT_KEY, _iso(intento), editable=False)
    _set_value(db, SYNC_RUNNING_KEY, "true", editable=False)
    db.commit()

    try:
        resultado = sync_ofertas(db)
        ahora = _utcnow()
        _set_value(db, SYNC_LAST_SUCCESS_KEY, _iso(ahora), editable=False)
        _set_value(db, SYNC_LAST_ERROR_KEY, "", editable=False)
        _set_value(db, SYNC_RUNNING_KEY, "false", editable=False)
        db.commit()
        resultado.setdefault("meta", {})["sincronizacion"] = obtener_estado_sync_ofertas(db)
        return resultado
    except Exception as exc:
        db.rollback()
        _set_value(db, SYNC_LAST_ERROR_KEY, f"{type(exc).__name__}: {exc}", editable=False)
        _set_value(db, SYNC_RUNNING_KEY, "false", editable=False)
        db.commit()
        raise


def iniciar_scheduler_sync_ofertas(SessionLocal):
    global _scheduler_started
    if _scheduler_started or not OFERTAS_AUTO_SYNC_ENABLED:
        return

    _scheduler_started = True
    _scheduler_stop.clear()

    def loop():
        _scheduler_stop.wait(max(0, OFERTAS_SYNC_START_DELAY_SECONDS))
        while not _scheduler_stop.is_set():
            db = SessionLocal()
            try:
                sincronizar_ofertas_cacheadas(db, force=False)
            except Exception:
                # La sincronizacion no debe tumbar la API ni bloquear Inicio.
                pass
            finally:
                db.close()

            sleep_seconds = min(max(float(OFERTAS_SYNC_INTERVAL_HOURS or 12) * 3600, 300), 3600)
            _scheduler_stop.wait(sleep_seconds)

    threading.Thread(target=loop, daemon=True, name="ofertas-sync-scheduler").start()


def detener_scheduler_sync_ofertas():
    global _scheduler_started
    _scheduler_stop.set()
    _scheduler_started = False
