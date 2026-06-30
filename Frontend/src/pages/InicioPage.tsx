import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, TouchEvent } from 'react';
import { ArrowRight, Banknote, Calculator, ChevronDown, MousePointerClick, RefreshCw, Smartphone, WalletCards } from 'lucide-react';
import { apiAssetUrl, obtenerTasasOperativas, sincronizarOfertas } from '../api/client';
import { obtenerTasasOperativasDedup } from '../api/dedupedReads';
import type { OfertaOperativa, PaqueteSaldoOperativo, TasaOperativaResponse } from '../types/api';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingToast } from '../components/FloatingToast';
import { CurrencySelect } from '../components/CurrencySelect';
import { PageLoader } from '../components/PageLoader';
import { UiSwitch } from '../components/UiSwitch';
import { useMonedasPagoActivas } from '../hooks/useMonedasPago';
import { isAbortError, useAbortableEffect } from '../hooks/useAbortableEffect';
import { useDocumentVisible } from '../hooks/useDocumentVisible';
import { TrackOrderPanel } from './inicio/TrackOrderPanel';
import { ServicesRatesGrid, type InicioCreateDraft, type InicioServiceCard, type InicioServicio } from './inicio/ServicesRatesGrid';
import { guardarMonedaPedidoPreferida, leerMonedaPedidoPreferida } from '../utils/preferenciasPedido';
import './inicio/InicioPage.css';

import logoJireh from '../assets/brand/logo-jireh.jpeg';
import tasasBanner from '../assets/brand/banner-jireh.jpeg';


type ServicioCrear = InicioServicio;

type GrupoMoneda = {
  moneda: string;
  ofertas: OfertaOperativa[];
  ofertasDivisa: OfertaOperativa[];
  paquetesSaldo: PaqueteSaldoOperativo[];
};

type OfertaCreateDraft = InicioCreateDraft;

type InicioPageProps = {
  operadorId?: number;
  canSyncTasas?: boolean;
  canLoadTasas?: boolean;
  onCreate: (servicio: ServicioCrear, draft?: OfertaCreateDraft) => void;
  onTrackPedido: (codigo: string) => void;
};

type ServiceCard = InicioServiceCard;

type RateTier = {
  kind: 'single' | 'tier' | 'top';
  oferta: OfertaOperativa;
  label: string;
  nextMinimum: number | null;
};

type CotizacionOferta = {
  rango: RateTier;
  tasa: number;
  total: number;
} | null;

type PromoBanner = {
  id: string;
  image: string;
  alt: string;
  title?: string;
  body?: string;
};

const PROMO_BANNERS: PromoBanner[] = [];

const TASAS_OPERATIVAS_CACHE_KEY = 'jireh.tasas-operativas.cache';

function leerTasasCache(): TasaOperativaResponse | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(TASAS_OPERATIVAS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TasaOperativaResponse;
    if (!parsed || !Array.isArray(parsed.ofertas) || !Array.isArray(parsed.paquetes_saldo)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function guardarTasasCache(data: TasaOperativaResponse) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(TASAS_OPERATIVAS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // La cache solo acelera la vista; si falla, la app sigue usando la respuesta viva.
  }
}

const serviceCards: ServiceCard[] = [
  {
    servicio: 'transferencia',
    title: 'Transferencias a Cuba',
    subtitle: 'Envio directo digital',
    tone: 'blue',
    icon: <WalletCards size={22} />,
  },
  {
    servicio: 'efectivo',
    title: 'Efectivo en mano',
    subtitle: 'Entrega en Santiago de Cuba',
    tone: 'green',
    icon: <Banknote size={22} />,
  },
  {
    servicio: 'saldo',
    title: 'Recargas moviles',
    subtitle: 'Paquetes activos de saldo',
    tone: 'purple',
    icon: <Smartphone size={22} />,
  },
  {
    servicio: 'divisa',
    title: 'Tarjetas en divisa',
    subtitle: 'Operaciones segun oferta',
    tone: 'gold',
    icon: <WalletCards size={22} />,
  },
];

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(numeric);
}

function monedaPago(moneda?: string | null) {
  return (moneda || 'BRL').trim().toUpperCase();
}

function etiquetaMoneda(moneda: string) {
  const etiquetas: Record<string, string> = {
    BRL: 'Pago en reales',
    UYU: 'Pago en pesos uruguayos',
    USD: 'Pago en dolares',
  };
  return etiquetas[moneda] || `Pago en ${moneda}`;
}

function nombreMoneda(moneda: string) {
  const etiquetas: Record<string, string> = {
    BRL: 'BRL',
    UYU: 'UYU',
    USD: 'USD',
  };
  return etiquetas[moneda] || moneda;
}

function ordenMoneda(moneda: string) {
  const orden: Record<string, number> = {
    BRL: 1,
    UYU: 2,
    USD: 3,
  };
  return orden[moneda] ?? 50;
}

function ordenarOfertas(ofertas: OfertaOperativa[]) {
  return [...ofertas].sort((a, b) => {
    const servicio = a.servicio.localeCompare(b.servicio);
    if (servicio !== 0) return servicio;
    return Number(a.minimo_pago ?? 0) - Number(b.minimo_pago ?? 0);
  });
}

function ofertasServicio(ofertas: OfertaOperativa[], servicio: ServicioCrear) {
  return ordenarOfertas(ofertas.filter((oferta) => oferta.servicio === servicio));
}

function minimoOferta(oferta: OfertaOperativa) {
  const minimo = Number(oferta.minimo_pago ?? 0);
  return Number.isFinite(minimo) ? minimo : 0;
}

function tasaOferta(oferta: OfertaOperativa) {
  const tasa = Number(oferta.tasa ?? 0);
  return Number.isFinite(tasa) ? tasa : 0;
}

function rangosOferta(ofertas: OfertaOperativa[]): RateTier[] {
  const ordenadas = ordenarOfertas(ofertas);
  if (ordenadas.length === 0) return [];

  return ordenadas.map((oferta, index) => {
    const nextMinimum = ordenadas[index + 1] ? minimoOferta(ordenadas[index + 1]) : null;
    return {
      kind: ordenadas.length === 1 ? 'single' : nextMinimum === null ? 'top' : 'tier',
      oferta,
      nextMinimum,
      label: nextMinimum === null
        ? `Más de ${formatNumber(minimoOferta(oferta))}`
        : `Menos de ${formatNumber(nextMinimum)}`,
    };
  });
}

function agruparOpcionesPorTasa(rangos: RateTier[]) {
  const agrupados: RateTier[] = [];

  for (const rango of rangos) {
    const anterior = agrupados[agrupados.length - 1];
    if (anterior && keyFloat(tasaOferta(anterior.oferta)) === keyFloat(tasaOferta(rango.oferta))) {
      anterior.nextMinimum = rango.nextMinimum;
      anterior.kind = rango.kind;
      anterior.label = rango.nextMinimum === null
        ? `Más de ${formatNumber(minimoOferta(anterior.oferta))}`
        : `Menos de ${formatNumber(rango.nextMinimum)}`;
      continue;
    }
    agrupados.push({ ...rango });
  }

  return agrupados;
}

function keyFloat(value: number) {
  return Math.round(value * 10000) / 10000;
}

function seleccionarRangoPorMonto(ofertas: OfertaOperativa[], monto: number) {
  const rangos = rangosOferta(ofertas);
  if (rangos.length === 0) return null;
  return [...rangos].reverse().find((rango) => monto >= minimoOferta(rango.oferta)) ?? rangos[0];
}

function cotizarOferta(ofertas: OfertaOperativa[], monto: number): CotizacionOferta {
  const rango = seleccionarRangoPorMonto(ofertas, monto);
  if (!rango) return null;
  const tasa = tasaOferta(rango.oferta);
  return {
    rango,
    tasa,
    total: monto * tasa,
  };
}

function etiquetaDivisa(oferta: OfertaOperativa) {
  const etiquetas: Record<string, string> = {
    mlc: 'MLC',
    usd: 'USD',
    clasica: 'Clasica',
  };
  return oferta.nombre || etiquetas[oferta.servicio] || oferta.servicio.toUpperCase();
}

function unidadDivisa(oferta: OfertaOperativa) {
  const unidades: Record<string, string> = {
    mlc: 'MLC',
    usd: 'USD',
    clasica: 'Clasica',
  };
  return unidades[oferta.servicio] || etiquetaDivisa(oferta);
}

function etiquetaLineaDivisa(oferta: OfertaOperativa) {
  const minimo = Number(oferta.minimo_pago ?? 0);
  if (minimo > 0) return `${etiquetaDivisa(oferta)} · ${formatNumber(minimo)}+ ${monedaPago(oferta.moneda_pago)}`;
  return etiquetaDivisa(oferta);
}

function tipoTarjetaDesdeOferta(oferta: OfertaOperativa) {
  const servicio = oferta.servicio.toLowerCase();
  if (servicio === 'usd') return 'USD';
  if (servicio === 'clasica') return 'OTRA';
  return 'MLC';
}

function fechaActualizacion(value?: string) {
  if (!value) return 'Actualizado ahora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Actualizado ahora';
  return `Actualizado ${date.toLocaleDateString('es-UY')} ${date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
}

function CotizadorResultado({ label, tone, cotizacion, moneda, onClick }: { label: string; tone: 'blue' | 'green'; cotizacion: CotizacionOferta; moneda: string; onClick: () => void }) {
  return (
    <button type="button" className={`live-rate-result ${tone}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{cotizacion ? formatNumber(cotizacion.total) : '-'} <small>CUP</small></strong>
      <em>{cotizacion ? `1 ${moneda} = ${formatNumber(cotizacion.tasa)} CUP` : 'Sin tasa activa'}</em>
    </button>
  );
}

function CotizadorVivo({ grupo, onCreate }: { grupo: GrupoMoneda; onCreate: InicioPageProps['onCreate'] }) {
  const [monto, setMonto] = useState('100');
  const montoNumerico = Number(monto.replace(',', '.')) || 0;
  const moneda = monedaPago(grupo.moneda);
  const transferencia = cotizarOferta(ofertasServicio(grupo.ofertas, 'transferencia'), montoNumerico);
  const efectivo = cotizarOferta(ofertasServicio(grupo.ofertas, 'efectivo'), montoNumerico);
  const rangoActivo = transferencia?.rango ?? efectivo?.rango;

  return (
    <section className="live-rate-panel" aria-label="Cotizador en vivo">
      <div className="live-rate-heading">
        <span className="live-rate-heading-icon"><Calculator size={18} /></span>
        <span>
          <h3>Calculadora</h3>
          <small>Escribe un monto y compara cuanto recibe el destinatario</small>
        </span>
      </div>
      <label className="live-rate-input">
        <span>Monto a enviar ({moneda})</span>
        <div>
          <input
            type="number"
            value={monto}
            min="0"
            inputMode="decimal"
            onChange={(event) => setMonto(event.target.value)}
            aria-label={`Monto a enviar en ${moneda}`}
          />
          <strong>{moneda}</strong>
        </div>
      </label>
      <div className="live-rate-results">
        <CotizadorResultado label="Transferencia Cuba" tone="blue" cotizacion={transferencia} moneda={moneda} onClick={() => onCreate('transferencia', { moneda_pago: grupo.moneda, monto_pago: monto })} />
        <CotizadorResultado label="Efectivo" tone="green" cotizacion={efectivo} moneda={moneda} onClick={() => onCreate('efectivo', { moneda_pago: grupo.moneda, monto_pago: monto })} />
      </div>
      {rangoActivo && (
        <div className="wholesale-live-badge">
          <ArrowRight size={15} /> Opcion aplicada: {rangoActivo.label} {moneda}
        </div>
      )}
    </section>
  );
}

function tasaDestacada(grupo: GrupoMoneda | undefined, servicio: ServicioCrear) {
  if (!grupo) return null;
  const oferta = ofertasServicio(grupo.ofertas, servicio)[0];
  return oferta ? { kind: 'single' as const, oferta, label: 'Tasa vigente', nextMinimum: null } : null;
}

function HeroCarousel({ grupo, generatedAt, loading, syncing, canSyncTasas, onRefresh, onCreate, promos = PROMO_BANNERS }: { grupo?: GrupoMoneda; generatedAt?: string; loading: boolean; syncing: boolean; canSyncTasas: boolean; onRefresh: () => void; onCreate: (servicio: ServicioCrear, draft?: OfertaCreateDraft) => void; promos?: PromoBanner[] }) {
  const [slideActivo, setSlideActivo] = useState(0);
  const [tocandoHero, setTocandoHero] = useState(false);
  const appVisible = useDocumentVisible();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tocandoHeroRef = useRef(false);
  const swipeActivoRef = useRef(false);
  const moneda = monedaPago(grupo?.moneda ?? 'BRL');
  const transferencia = tasaDestacada(grupo, 'transferencia');
  const efectivo = tasaDestacada(grupo, 'efectivo');

  function crearDesdePrecio(servicio: ServicioCrear, rango: RateTier | null) {
    onCreate(servicio, {
      moneda_pago: moneda,
      monto_pago: rango ? String(minimoOferta(rango.oferta) || '') : undefined,
    });
  }

  const slides: { key: string; className: string; content: ReactNode }[] = [
    {
      key: 'precios',
      className: 'precios',
      content: (
        <div className="hero-slide-content hero-price-slide">
          <span className="hero-kicker">Mas vendidos</span>
          <h2>Precios destacados</h2>
          <div className="hero-rate-pair">
            <button className="hero-rate-pill blue" type="button" onClick={() => crearDesdePrecio('transferencia', transferencia)}>
              <small>Transferencia</small>
              <span className="hero-rate-action-row">
                <strong className="hero-rate-price"><span>1 {moneda} =</span><b>{transferencia ? formatNumber(transferencia.oferta.tasa) : '-'} CUP</b></strong>
                <em>Crear orden</em>
              </span>
            </button>
            <button className="hero-rate-pill green" type="button" onClick={() => crearDesdePrecio('efectivo', efectivo)}>
              <small>Efectivo</small>
              <span className="hero-rate-action-row">
                <strong className="hero-rate-price"><span>1 {moneda} =</span><b>{efectivo ? formatNumber(efectivo.oferta.tasa) : '-'} CUP</b></strong>
                <em>Crear orden</em>
              </span>
            </button>
          </div>
        </div>
      ),
    },
    ...promos.map((promo) => ({
      key: `promo-${promo.id}`,
      className: 'promo',
      content: (
        <div className="hero-slide-content hero-promo-image-slide">
          <img className="hero-promo-image" src={promo.image} alt={promo.alt} />
          {(promo.title || promo.body) && (
            <span className="hero-promo-copy">
              {promo.title && <strong>{promo.title}</strong>}
              {promo.body && <small>{promo.body}</small>}
            </span>
          )}
        </div>
      ),
    })),
    {
      key: 'marca',
      className: 'marca',
      content: (
        <div className="hero-slide-content hero-brand-slide">
          <img className="rates-logo hero-brand-logo" src={logoJireh} alt="El Jireh" />
          <span>
            <span className="hero-kicker">El Jireh</span>
            <h2>Remesas con control y confianza</h2>
            <p>{fechaActualizacion(generatedAt)}</p>
          </span>
        </div>
      ),
    },
  ];

  function moverSlide(direccion: 1 | -1) {
    if (slides.length <= 1) return;
    setSlideActivo((current) => (current + direccion + slides.length) % slides.length);
  }

  function handleHeroTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    tocandoHeroRef.current = true;
    setTocandoHero(true);
    swipeActivoRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleHeroTouchMove(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || slides.length <= 1) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

    swipeActivoRef.current = true;
    moverSlide(deltaX < 0 ? 1 : -1);
    touchStartRef.current = null;
  }

  function handleHeroTouchEnd() {
    tocandoHeroRef.current = false;
    setTocandoHero(false);
    touchStartRef.current = null;
  }

  function handleHeroClickCapture(event: MouseEvent<HTMLElement>) {
    if (!swipeActivoRef.current) return;
    swipeActivoRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    if (!appVisible || tocandoHero || slides.length <= 1) return undefined;
    const id = window.setInterval(() => {
      if (!tocandoHeroRef.current) moverSlide(1);
    }, 6200);
    return () => window.clearInterval(id);
  }, [appVisible, tocandoHero, slides.length]);

  useEffect(() => {
    if (slideActivo >= slides.length) setSlideActivo(0);
  }, [slideActivo, slides.length]);

  return (
    <section
      className="rates-hero hero-carousel"
      aria-label="Resumen comercial de inicio"
      onClickCapture={handleHeroClickCapture}
      onTouchStart={handleHeroTouchStart}
      onTouchMove={handleHeroTouchMove}
      onTouchEnd={handleHeroTouchEnd}
      onTouchCancel={handleHeroTouchEnd}
    >
      <img className="rates-hero-bg" src={tasasBanner} alt="Jireh Remesas tasa de cambio" />
      <div className={`hero-carousel-panel ${slides[slideActivo].className}`}>{slides[slideActivo].content}</div>
      {canSyncTasas && (
        <button className="ghost-button hero-refresh" onClick={onRefresh} disabled={loading || syncing}>
          <RefreshCw size={17} /> {syncing ? 'Sincronizando...' : loading ? 'Cargando...' : 'Sincronizar'}
        </button>
      )}
      <div className="hero-carousel-dots" aria-label="Slides del banner">
        {slides.map((slide, index) => (
          <button
            key={slide.key}
            type="button"
            className={slideActivo === index ? 'active' : ''}
            onClick={() => setSlideActivo(index)}
            aria-label={`Ver slide ${index + 1}`}
            aria-current={slideActivo === index ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function RateTierRows({ ofertas, moneda, servicio, onCreate }: { ofertas: OfertaOperativa[]; moneda: string; servicio: ServicioCrear; onCreate: (servicio: ServicioCrear, draft?: OfertaCreateDraft) => void }) {
  const rangos = rangosOferta(ofertas);
  const [showRepeated, setShowRepeated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const opciones = showRepeated ? rangos : agruparOpcionesPorTasa(rangos);
  const visibles = expanded ? opciones : opciones.slice(0, 4);

  return (
    <div className="rate-lines operation-tier-lines">
      <div className="rate-options-toolbar">
        <span>{opciones.length} {opciones.length === 1 ? 'opcion' : 'opciones'}</span>
        <label className="rate-repeat-switch">
          <span>Mostrar tasas repetidas</span>
          <UiSwitch
            checked={showRepeated}
            ariaLabel="Mostrar tasas repetidas"
            onChange={(checked) => {
              setShowRepeated(checked);
              setExpanded(false);
            }}
          />
        </label>
      </div>
      <div className="rate-tier-table-head" aria-hidden="true">
        <span>Monto ({moneda})</span>
        <span>Tasa</span>
        <span>Recibe</span>
      </div>
      {visibles.map((rango) => (
        <button
          type="button"
          className={`rate-line rate-tier-row ${rango.kind}`}
          key={`${servicio}-${rango.oferta.id}`}
          onClick={() => onCreate(servicio, { monto_pago: String(minimoOferta(rango.oferta) || ''), moneda_pago: moneda })}
        >
          <span className="rate-tier-copy">
            <span className="rate-tier-label">{rango.label}</span>
            <small>Seleccionar esta opcion</small>
          </span>
          <strong className="rate-tier-price"><b>{formatNumber(rango.oferta.tasa)}</b></strong>
          <span className="rate-tier-receives">{formatNumber(minimoOferta(rango.oferta) * tasaOferta(rango.oferta))} CUP</span>
        </button>
      ))}
      {opciones.length > 4 && (
        <button className="rate-tier-toggle" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
          {expanded ? 'Ver menos' : `Ver las ${opciones.length} opciones`}
          <ChevronDown size={16} className={expanded ? 'expanded' : ''} />
        </button>
      )}
    </div>
  );
}

export function InicioPage({ operadorId, canSyncTasas = false, canLoadTasas = true, onCreate, onTrackPedido }: InicioPageProps) {
  const [data, setData] = useState<TasaOperativaResponse | null>(() => leerTasasCache());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monedaSeleccionada, setMonedaSeleccionada] = useState(() => leerMonedaPedidoPreferida('BRL', operadorId));

  async function cargarTasas(options: { silent?: boolean; deduped?: boolean; signal?: AbortSignal } = {}) {
    const silent = Boolean(options.silent);
    const deduped = options.deduped ?? true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const nextData = deduped ? await obtenerTasasOperativasDedup({ signal: options.signal }) : await obtenerTasasOperativas({ signal: options.signal });
      setData(nextData);
      guardarTasasCache(nextData);
    } catch (err) {
      if (!isAbortError(err)) setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasas');
    } finally {
      if (!silent && !options.signal?.aborted) setLoading(false);
    }
  }

  async function actualizarTasas() {
    if (!canLoadTasas) return;

    if (!canSyncTasas) {
      await cargarTasas();
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      await sincronizarOfertas();
      const nextData = await obtenerTasasOperativas();
      setData(nextData);
      guardarTasasCache(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron sincronizar las tasas');
    } finally {
      setSyncing(false);
    }
  }

  useAbortableEffect((signal) => {
    if (!canLoadTasas) return;
    void cargarTasas({ silent: Boolean(data), signal });
  }, [canLoadTasas]);

  useEffect(() => {
    setMonedaSeleccionada(leerMonedaPedidoPreferida('BRL', operadorId));
  }, [operadorId]);
  const monedasActivas = useMonedasPagoActivas();
  const monedasActivasSet = useMemo(() => new Set(monedasActivas), [monedasActivas]);

  const gruposMoneda = useMemo(() => {
    const grupos = new Map<string, GrupoMoneda>();

    function obtenerGrupo(moneda: string) {
      const normalizada = monedaPago(moneda);
      const existente = grupos.get(normalizada);
      if (existente) return existente;
      const nuevo: GrupoMoneda = {
        moneda: normalizada,
        ofertas: [],
        ofertasDivisa: [],
        paquetesSaldo: [],
      };
      grupos.set(normalizada, nuevo);
      return nuevo;
    }

    for (const oferta of data?.ofertas ?? []) {
      obtenerGrupo(oferta.moneda_pago ?? 'BRL').ofertas.push(oferta);
    }

    for (const oferta of data?.ofertas_divisa ?? []) {
      obtenerGrupo(oferta.moneda_pago ?? 'BRL').ofertasDivisa.push(oferta);
    }

    for (const paquete of data?.paquetes_saldo ?? []) {
      obtenerGrupo(paquete.moneda_pago ?? 'BRL').paquetesSaldo.push(paquete);
    }

    return [...grupos.values()]
      .filter((grupo) => monedasActivasSet.has(grupo.moneda))
      .map((grupo) => ({
        ...grupo,
        ofertas: ordenarOfertas(grupo.ofertas),
        ofertasDivisa: ordenarOfertas(grupo.ofertasDivisa),
        paquetesSaldo: [...grupo.paquetesSaldo].sort((a, b) => Number(a.monto_pago) - Number(b.monto_pago)),
      }))
      .sort((a, b) => {
        const orden = ordenMoneda(a.moneda) - ordenMoneda(b.moneda);
        if (orden !== 0) return orden;
        return a.moneda.localeCompare(b.moneda);
      });
  }, [data, monedasActivasSet]);

  useEffect(() => {
    if (gruposMoneda.length === 0) return;
    if (!gruposMoneda.some((grupo) => grupo.moneda === monedaSeleccionada)) {
      setMonedaSeleccionada(gruposMoneda[0].moneda);
      guardarMonedaPedidoPreferida(gruposMoneda[0].moneda, operadorId);
    }
  }, [gruposMoneda, monedaSeleccionada, operadorId]);

  function cambiarMonedaSeleccionada(moneda: string) {
    setMonedaSeleccionada(moneda);
    guardarMonedaPedidoPreferida(moneda, operadorId);
  }

  const grupoActivo = gruposMoneda.find((grupo) => grupo.moneda === monedaSeleccionada) ?? gruposMoneda[0];
  const promocionesCarrusel = useMemo<PromoBanner[]>(() => (data?.promociones ?? []).filter((promocion) => promocion.tipo === 'promocion' && promocion.imagen_url).map((promocion) => ({
    id: String(promocion.id),
    image: apiAssetUrl(promocion.imagen_url),
    alt: promocion.titulo || 'Promocion',
    title: promocion.titulo || undefined,
    body: promocion.descripcion || undefined,
  })), [data?.promociones]);

  return (
    <section className="home-page app-page-width">
      <HeroCarousel grupo={grupoActivo} generatedAt={data?.sync?.last_success_at ?? data?.generated_at} loading={loading} syncing={syncing} canSyncTasas={canSyncTasas} onRefresh={actualizarTasas} onCreate={onCreate} promos={promocionesCarrusel} />

      {error && <FloatingToast onDismiss={() => setError(null)}>{error}</FloatingToast>}
      {!error && !loading && data && gruposMoneda.length === 0 && (
        <DismissibleNotice className="notice warning">No hay tasas activas configuradas</DismissibleNotice>
      )}

      {loading && !data && <PageLoader label="Cargando tasas" inline />}

      {grupoActivo && (
        <div className="rates-currency-sections">
          <section className="rates-currency-section" key={grupoActivo.moneda}>
            <section className="home-currency-card" aria-labelledby="home-currency-title">
              <header className="rates-currency-header operation-currency-header">
                <div className="operation-currency-copy">
                  <h3 id="home-currency-title">Moneda de recepcion</h3>
                  <p>{etiquetaMoneda(grupoActivo.moneda)}</p>
                </div>
                <CurrencySelect
                  value={monedaSeleccionada}
                  currencies={gruposMoneda.map((grupo) => grupo.moneda)}
                  onChange={cambiarMonedaSeleccionada}
                />
              </header>
            </section>

            <CotizadorVivo grupo={grupoActivo} onCreate={onCreate} />

            <ServicesRatesGrid
              moneda={grupoActivo.moneda}
              ofertas={grupoActivo.ofertas}
              ofertasDivisa={grupoActivo.ofertasDivisa}
              paquetesSaldo={grupoActivo.paquetesSaldo}
              cards={serviceCards}
              onCreate={onCreate}
              ofertasServicio={ofertasServicio}
              monedaPago={monedaPago}
              nombreMoneda={nombreMoneda}
              formatNumber={formatNumber}
              etiquetaDivisa={etiquetaDivisa}
              tipoTarjetaDesdeOferta={tipoTarjetaDesdeOferta}
              renderRateRows={(ofertas, moneda, servicio) => (
                <RateTierRows ofertas={ofertas} moneda={moneda} servicio={servicio} onCreate={onCreate} />
              )}
            />
          </section>
        </div>
      )}

      <section className="home-tracking-section" aria-label="Rastreo de pedidos">
        <TrackOrderPanel onTrackPedido={onTrackPedido} />
      </section>
    </section>
  );
}
