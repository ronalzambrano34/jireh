export type MonedaPagoConfig = {
  codigo: string;
  nombre: string;
  simbolo?: string;
  bandera?: string;
  activa: boolean;
};

export const MONEDAS_PAGO_CONFIG_KEY = 'monedas_pago_catalogo';
export const MONEDAS_PAGO_STORAGE_KEY = 'jireh.monedasPago.catalogo';
export const MONEDAS_PAGO_CHANGED_EVENT = 'jireh:monedas-pago-changed';

export const MONEDAS_PAGO_DEFAULT: MonedaPagoConfig[] = [
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', bandera: '🇧🇷', activa: true },
  { codigo: 'UYU', nombre: 'Peso uruguayo', simbolo: '$U', bandera: '🇺🇾', activa: true },
  { codigo: 'USD', nombre: 'Dolar estadounidense', simbolo: 'US$', bandera: '🇺🇸', activa: false },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€', bandera: '🇪🇺', activa: false },
];

export function normalizarMoneda(moneda?: string | null) {
  return (moneda || '').trim().toUpperCase();
}

function normalizarItemMoneda(item: Partial<MonedaPagoConfig> | string): MonedaPagoConfig | null {
  if (typeof item === 'string') {
    const codigo = normalizarMoneda(item);
    if (!codigo) return null;
    const base = MONEDAS_PAGO_DEFAULT.find((moneda) => moneda.codigo === codigo);
    return base ? { ...base } : { codigo, nombre: codigo, activa: true };
  }

  const codigo = normalizarMoneda(item.codigo);
  if (!codigo) return null;
  const base = MONEDAS_PAGO_DEFAULT.find((moneda) => moneda.codigo === codigo);
  return {
    codigo,
    nombre: (item.nombre || base?.nombre || codigo).trim(),
    simbolo: (item.simbolo || base?.simbolo || '').trim() || undefined,
    bandera: (item.bandera || base?.bandera || '').trim() || undefined,
    activa: Boolean(item.activa),
  };
}

export function normalizarCatalogoMonedasPago(items?: Array<Partial<MonedaPagoConfig> | string> | null) {
  const map = new Map<string, MonedaPagoConfig>();

  if (!items) {
    for (const item of MONEDAS_PAGO_DEFAULT) {
      map.set(item.codigo, { ...item });
    }
  }

  for (const item of items ?? []) {
    const normalizada = normalizarItemMoneda(item);
    if (normalizada) map.set(normalizada.codigo, normalizada);
  }

  const catalogo = Array.from(map.values()).sort((a, b) => {
    const indexA = MONEDAS_PAGO_DEFAULT.findIndex((item) => item.codigo === a.codigo);
    const indexB = MONEDAS_PAGO_DEFAULT.findIndex((item) => item.codigo === b.codigo);
    if (indexA >= 0 || indexB >= 0) return (indexA >= 0 ? indexA : 999) - (indexB >= 0 ? indexB : 999);
    return a.codigo.localeCompare(b.codigo);
  });

  if (catalogo.length === 0) return MONEDAS_PAGO_DEFAULT.map((item) => ({ ...item }));

  return catalogo.some((item) => item.activa)
    ? catalogo
    : catalogo.map((item) => ({ ...item, activa: item.codigo === 'BRL' || item.codigo === 'UYU' }));
}

export function catalogoMonedasPagoDesdeValor(value?: string | null) {
  if (!value) return normalizarCatalogoMonedasPago();
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return normalizarCatalogoMonedasPago(parsed);
  } catch {
    return normalizarCatalogoMonedasPago(value.split(',').map((item) => item.trim()));
  }
  return normalizarCatalogoMonedasPago();
}

export function leerCatalogoMonedasPagoLocal() {
  if (typeof localStorage === 'undefined') return normalizarCatalogoMonedasPago();
  return catalogoMonedasPagoDesdeValor(localStorage.getItem(MONEDAS_PAGO_STORAGE_KEY));
}

export function guardarCatalogoMonedasPagoLocal(items: MonedaPagoConfig[]) {
  const catalogo = normalizarCatalogoMonedasPago(items);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MONEDAS_PAGO_STORAGE_KEY, JSON.stringify(catalogo));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MONEDAS_PAGO_CHANGED_EVENT, { detail: { catalogo } }));
  }
  return catalogo;
}

export function monedasPagoActivas(catalogo = leerCatalogoMonedasPagoLocal()) {
  return catalogo.filter((item) => item.activa).map((item) => item.codigo);
}

function monedaCatalogo(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  return leerCatalogoMonedasPagoLocal().find((item) => item.codigo === normalizada)
    ?? MONEDAS_PAGO_DEFAULT.find((item) => item.codigo === normalizada);
}

export function monedasDisponibles(monedas: Array<string | null | undefined>) {
  const disponibles = [...new Set(monedas.map(normalizarMoneda).filter(Boolean))];
  const activas = new Set(monedasPagoActivas());
  return disponibles.filter((moneda) => activas.has(moneda));
}

export function banderaMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  const configurada = monedaCatalogo(normalizada);
  if (configurada?.bandera) return configurada.bandera;
  const banderas: Record<string, string> = {
    BRL: '🇧🇷',
    UYU: '🇺🇾',
    USD: '🇺🇸',
    EUR: '🇪🇺',
  };
  return banderas[normalizada] || '💱';
}

export function nombreMoneda(moneda?: string | null) {
  const normalizada = normalizarMoneda(moneda);
  const configurada = monedaCatalogo(normalizada);
  if (configurada?.nombre) return configurada.nombre;
  const nombres: Record<string, string> = {
    BRL: 'Real brasileño',
    UYU: 'Peso uruguayo',
    USD: 'Dolar estadounidense',
    EUR: 'Euro',
  };
  return nombres[normalizada] || normalizada;
}
