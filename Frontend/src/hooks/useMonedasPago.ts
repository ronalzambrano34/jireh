import { useEffect, useMemo, useState } from 'react';
import { listarConfiguraciones } from '../api/client';
import {
  MONEDAS_PAGO_CHANGED_EVENT,
  MONEDAS_PAGO_CONFIG_KEY,
  MONEDAS_PAGO_STORAGE_KEY,
  catalogoMonedasPagoDesdeValor,
  guardarCatalogoMonedasPagoLocal,
  leerCatalogoMonedasPagoLocal,
  monedasPagoActivas,
  normalizarCatalogoMonedasPago,
  normalizarMoneda,
} from '../utils/monedas';

let monedasPagoConfigPromise: Promise<ReturnType<typeof leerCatalogoMonedasPagoLocal>> | null = null;

async function cargarCatalogoMonedasPago() {
  if (!monedasPagoConfigPromise) {
    monedasPagoConfigPromise = listarConfiguraciones()
      .then((configuraciones) => {
        const catalogo = catalogoMonedasPagoDesdeValor(
          configuraciones.find((item) => item.clave === MONEDAS_PAGO_CONFIG_KEY)?.valor,
        );
        guardarCatalogoMonedasPagoLocal(catalogo);
        return catalogo;
      })
      .catch(() => leerCatalogoMonedasPagoLocal());
  }

  return monedasPagoConfigPromise;
}

export function useCatalogoMonedasPago() {
  const [catalogo, setCatalogo] = useState(leerCatalogoMonedasPagoLocal);

  useEffect(() => {
    let alive = true;

    function applyCatalogo(nextCatalogo: ReturnType<typeof leerCatalogoMonedasPagoLocal>) {
      if (alive) setCatalogo(normalizarCatalogoMonedasPago(nextCatalogo));
    }

    function handleChanged(event: Event) {
      const detail = (event as CustomEvent<{ catalogo?: ReturnType<typeof leerCatalogoMonedasPagoLocal> }>).detail;
      if (detail?.catalogo) applyCatalogo(detail.catalogo);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === MONEDAS_PAGO_STORAGE_KEY) applyCatalogo(catalogoMonedasPagoDesdeValor(event.newValue));
    }

    window.addEventListener(MONEDAS_PAGO_CHANGED_EVENT, handleChanged);
    window.addEventListener('storage', handleStorage);
    cargarCatalogoMonedasPago().then(applyCatalogo);

    return () => {
      alive = false;
      window.removeEventListener(MONEDAS_PAGO_CHANGED_EVENT, handleChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return catalogo;
}

export function useMonedasPagoActivas(extraCodes: string[] = []) {
  const catalogo = useCatalogoMonedasPago();
  const extraKey = extraCodes.map(normalizarMoneda).join('|');

  return useMemo(() => {
    const activeCodes = monedasPagoActivas(catalogo);
    const extras = extraCodes.map(normalizarMoneda).filter(Boolean);
    return Array.from(new Set([...activeCodes, ...extras]));
  }, [catalogo, extraKey]);
}

export function useMonedasPagoPermitidas(candidates: string[], extraCodes: string[] = []) {
  const catalogo = useCatalogoMonedasPago();
  const candidatesKey = candidates.map(normalizarMoneda).join('|');
  const extraKey = extraCodes.map(normalizarMoneda).join('|');

  return useMemo(() => {
    const active = new Set(monedasPagoActivas(catalogo));
    const extras = new Set(extraCodes.map(normalizarMoneda).filter(Boolean));
    return Array.from(new Set(candidates.map(normalizarMoneda).filter(Boolean)))
      .filter((code) => active.has(code) || extras.has(code));
  }, [catalogo, candidatesKey, extraKey]);
}
