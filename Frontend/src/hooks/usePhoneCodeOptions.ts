import { useEffect, useMemo, useState } from 'react';
import { listarConfiguraciones } from '../api/client';
import {
  PHONE_CODES_CHANGED_EVENT,
  PHONE_CODES_CONFIG_KEY,
  PHONE_CODES_STORAGE_KEY,
  codigosPaisActivosDesdeValor,
  codigosPaisDisponibles,
  guardarCodigosPaisActivosLocal,
  leerCodigosPaisActivosLocal,
} from '../utils/telefonos';

let phoneCodesConfigPromise: Promise<string[]> | null = null;

async function cargarCodigosPaisActivos() {
  if (!phoneCodesConfigPromise) {
    phoneCodesConfigPromise = listarConfiguraciones()
      .then((configuraciones) => {
        const activos = codigosPaisActivosDesdeValor(
          configuraciones.find((item) => item.clave === PHONE_CODES_CONFIG_KEY)?.valor,
        );
        guardarCodigosPaisActivosLocal(activos);
        return activos;
      })
      .catch(() => leerCodigosPaisActivosLocal());
  }

  return phoneCodesConfigPromise;
}

export function usePhoneCodeOptions(extraCodes: string[] = []) {
  const [activeCodes, setActiveCodes] = useState(leerCodigosPaisActivosLocal);
  const extraKey = extraCodes.join('|');

  useEffect(() => {
    let alive = true;

    function applyCodes(codes: string[]) {
      if (alive) setActiveCodes(codes);
    }

    function handleChanged(event: Event) {
      const detail = (event as CustomEvent<{ codes?: string[] }>).detail;
      if (detail?.codes) applyCodes(detail.codes);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === PHONE_CODES_STORAGE_KEY) applyCodes(codigosPaisActivosDesdeValor(event.newValue));
    }

    window.addEventListener(PHONE_CODES_CHANGED_EVENT, handleChanged);
    window.addEventListener('storage', handleStorage);
    cargarCodigosPaisActivos().then(applyCodes);

    return () => {
      alive = false;
      window.removeEventListener(PHONE_CODES_CHANGED_EVENT, handleChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return useMemo(() => codigosPaisDisponibles(activeCodes, extraCodes), [activeCodes, extraKey]);
}
