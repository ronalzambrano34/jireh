import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { MouseEvent, ReactNode, TouchEvent } from 'react';
import { ArrowRight, Banknote, Calculator, CheckCircle2, ChevronDown, ClipboardList, Clock3, Flame, RefreshCw, Search, Smartphone, WalletCards } from 'lucide-react';
import { apiAssetUrl, obtenerPedido, obtenerTasasOperativas, sincronizarOfertas } from '../api/client';
import type { OfertaOperativa, PaqueteSaldoOperativo, PedidoDetalle, TasaOperativaResponse } from '../types/api';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { PageLoader } from '../components/PageLoader';

import logoJireh from '../assets/brand/logo-jireh.jpeg';
import tasasBanner from '../assets/brand/banner-jireh.jpeg';


type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa';

type GrupoMoneda = {
  moneda: string;
  ofertas: OfertaOperativa[];
  ofertasDivisa: OfertaOperativa[];
  paquetesSaldo: PaqueteSaldoOperativo[];
};

type OfertaCreateDraft = {
  monto_pago?: string;
  moneda_pago?: string;
  paquete_saldo_id?: string;
  monto_divisa?: string;
  tipo_tarjeta?: string;
};

type InicioPageProps = {
  canSyncTasas?: boolean;
  onCreate: (servicio: ServicioCrear, draft?: OfertaCreateDraft) => void;
  onTrackPedido: (codigo: string) => void;
};

type ServiceCard = {
  servicio: ServicioCrear;
  title: string;
  subtitle: string;
  tone: string;
  icon: ReactNode;
};

type RateTier = {
  kind: 'base' | 'wholesale' | 'single';
  oferta: OfertaOperativa;
  label: string;
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
    BRL: 'BRL (Real Brasil)',
    UYU: 'UYU (Peso Uruguay)',
    USD: 'USD (Dolar)',
  };
  return etiquetas[moneda] || moneda;
}

function banderaMoneda(moneda: string) {
  const banderas: Record<string, string> = {
    BRL: '🇧🇷',
    UYU: '🇺🇾',
    USD: '🇺🇸',
  };
  return banderas[moneda] || '💱';
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

const MINIMO_MAYORISTA = 1000;

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

  const estandarCandidatas = ordenadas.filter((oferta) => minimoOferta(oferta) < MINIMO_MAYORISTA);
  const estandar = estandarCandidatas[estandarCandidatas.length - 1] ?? ordenadas[0];
  const mayorista = ordenadas.find((oferta) => minimoOferta(oferta) >= MINIMO_MAYORISTA);

  if (!mayorista || mayorista.id === estandar.id) {
    return [{ kind: 'single', oferta: estandar, label: 'Tasa vigente' }];
  }

  return [
    { kind: 'base', oferta: estandar, label: `Tasa estandar (<${formatNumber(minimoOferta(mayorista))})` },
    { kind: 'wholesale', oferta: mayorista, label: 'Mayorista (>1000)' },
  ];
}

function seleccionarRangoPorMonto(ofertas: OfertaOperativa[], monto: number) {
  const rangos = rangosOferta(ofertas);
  if (rangos.length === 0) return null;
  const mayorista = rangos.find((rango) => rango.kind === 'wholesale');
  if (mayorista && monto >= minimoOferta(mayorista.oferta)) return mayorista;
  return rangos[0];
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

function CotizadorResultado({ label, tone, cotizacion, moneda }: { label: string; tone: 'blue' | 'green'; cotizacion: CotizacionOferta; moneda: string }) {
  return (
    <div className={`live-rate-result ${tone}`}>
      <span>{label}</span>
      <strong>{cotizacion ? formatNumber(cotizacion.total) : '-'} <small>CUP</small></strong>
      <em>{cotizacion ? `1 ${moneda} = ${formatNumber(cotizacion.tasa)} CUP` : 'Sin tasa activa'}</em>
    </div>
  );
}

function CotizadorVivo({ grupo }: { grupo: GrupoMoneda }) {
  const [monto, setMonto] = useState('200');
  const montoNumerico = Number(monto.replace(',', '.')) || 0;
  const moneda = monedaPago(grupo.moneda);
  const transferencia = cotizarOferta(ofertasServicio(grupo.ofertas, 'transferencia'), montoNumerico);
  const efectivo = cotizarOferta(ofertasServicio(grupo.ofertas, 'efectivo'), montoNumerico);
  const mayoristaActivo = [transferencia, efectivo].find((cotizacion) => cotizacion?.rango.kind === 'wholesale');

  return (
    <section className="live-rate-panel" aria-label="Cotizador en vivo">
      <div className="live-rate-heading">
        <span className="live-rate-heading-icon"><Calculator size={18} /></span>
        <span>
          <h3>Calculadora</h3>
          <small>Calcula automaticamente segun el rango de la oferta</small>
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
        <CotizadorResultado label="Transferencia Cuba" tone="blue" cotizacion={transferencia} moneda={moneda} />
        <CotizadorResultado label="Efectivo" tone="green" cotizacion={efectivo} moneda={moneda} />
      </div>
      {mayoristaActivo && (
        <div className="wholesale-live-badge">
          <Flame size={15} /> Monto de {formatNumber(minimoOferta(mayoristaActivo.rango.oferta))}+ aplica tasa mayorista
        </div>
      )}
    </section>
  );
}

function tasaDestacada(grupo: GrupoMoneda | undefined, servicio: ServicioCrear) {
  if (!grupo) return null;
  const oferta = ofertasServicio(grupo.ofertas, servicio)[0];
  return oferta ? { kind: 'base' as const, oferta, label: 'Tasa vigente' } : null;
}

function HeroCarousel({ grupo, generatedAt, loading, syncing, canSyncTasas, onRefresh, onCreate, promos = PROMO_BANNERS }: { grupo?: GrupoMoneda; generatedAt?: string; loading: boolean; syncing: boolean; canSyncTasas: boolean; onRefresh: () => void; onCreate: (servicio: ServicioCrear, draft?: OfertaCreateDraft) => void; promos?: PromoBanner[] }) {
  const [slideActivo, setSlideActivo] = useState(0);
  const [tocandoHero, setTocandoHero] = useState(false);
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
    if (tocandoHero || slides.length <= 1) return undefined;
    const id = window.setInterval(() => {
      if (!tocandoHeroRef.current) moverSlide(1);
    }, 6200);
    return () => window.clearInterval(id);
  }, [tocandoHero, slides.length]);

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

  return (
    <div className="rate-lines operation-tier-lines">
      {rangos.map((rango) => (
        <button
          type="button"
          className={`rate-line rate-tier-row ${rango.kind}`}
          key={`${servicio}-${rango.kind}-${rango.oferta.id}`}
          onClick={() => onCreate(servicio, { monto_pago: String(minimoOferta(rango.oferta) || ''), moneda_pago: moneda })}
        >
          <span className={`rate-tier-icon ${rango.kind}`}>
            {rango.kind === 'wholesale' ? <Flame size={16} /> : <ArrowRight size={16} />}
          </span>
          <span className="rate-tier-copy">
            <span className="rate-tier-label">{rango.label}</span>
            <small>Desde {formatNumber(minimoOferta(rango.oferta))} {moneda}</small>
          </span>
          <strong className="rate-tier-price"><small>1 {moneda} =</small> <b>{formatNumber(rango.oferta.tasa)} CUP</b></strong>
        </button>
      ))}
    </div>
  );
}

function trackEstadoLabel(value: string) {
  const labels: Record<string, string> = {
    pendiente_pago: 'Pendiente pago',
    pago_confirmado: 'Pago confirmado',
    en_operacion: 'Pago confirmado',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}

function trackStepIndex(pedido: PedidoDetalle | null) {
  if (!pedido) return 1;
  if (pedido.estado === 'completado') return 2;
  if (pedido.estado === 'pendiente_pago') return 0;
  return 1;
}

function trackStepClass(index: number, activeIndex: number, completado: boolean) {
  if (completado || index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return '';
}

function TrackOrderPanel({ onTrackPedido }: { onTrackPedido: (codigo: string) => void }) {
  const [codigo, setCodigo] = useState('');
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const codigoLimpio = codigo.trim().toUpperCase();
  const activeIndex = trackStepIndex(pedido);
  const pedidoCompletado = pedido?.estado === 'completado';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codigoLimpio) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setPedido(null);
    try {
      setPedido(await obtenerPedido(codigoLimpio));
    } catch (err) {
      setTrackingError(err instanceof Error ? err.message : 'No se pudo rastrear el pedido');
    } finally {
      setTrackingLoading(false);
    }
  }

  return (
    <section className="track-order-panel" aria-label="Rastrear pedido">
      <div className="track-order-head">
        <span className="track-order-icon"><ClipboardList size={22} /></span>
        <span>
          <h3>Rastrear pedido</h3>
          <small>Codigo de operacion</small>
        </span>
      </div>
      <form className="track-order-form" onSubmit={handleSubmit}>
        <label className="track-order-input">
          <Search size={17} />
          <input
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            placeholder="Ej. JH-3204-CUBA"
            autoComplete="off"
            spellCheck={false}
            aria-label="Codigo de operacion"
          />
        </label>
        <button className="primary-button" type="submit" disabled={!codigoLimpio || trackingLoading}>{trackingLoading ? 'Buscando...' : 'Rastrear'}</button>
      </form>
      {pedido && (
        <div className="track-order-steps" aria-hidden="true">
          <span className={trackStepClass(0, activeIndex, pedidoCompletado)}><CheckCircle2 size={16} /><small>Recibido</small></span>
          <span className={trackStepClass(1, activeIndex, pedidoCompletado)}><Clock3 size={16} /><small>Procesando</small></span>
          <span className={trackStepClass(2, activeIndex, pedidoCompletado)}><CheckCircle2 size={16} /><small>Completado</small></span>
        </div>
      )}
      {trackingError && <div className="track-order-result error">{trackingError}</div>}
      {pedido && (
        <div className={`track-order-result ${pedido.estado}`}>
          <span><small>Estado</small><strong>{trackEstadoLabel(pedido.estado)}</strong></span>
          <span><small>Codigo</small><strong>{pedido.codigo_operacion}</strong></span>
          <button className="ghost-button" type="button" onClick={() => onTrackPedido(pedido.codigo_operacion)}>Abrir detalle</button>
        </div>
      )}
    </section>
  );
}

export function InicioPage({ canSyncTasas = false, onCreate, onTrackPedido }: InicioPageProps) {
  const [data, setData] = useState<TasaOperativaResponse | null>(() => leerTasasCache());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('BRL');
  const [monedaMenuOpen, setMonedaMenuOpen] = useState(false);

  async function cargarTasas(options: { silent?: boolean } = {}) {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setError(null);
    try {
      const nextData = await obtenerTasasOperativas();
      setData(nextData);
      guardarTasasCache(nextData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasas');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function actualizarTasas() {
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

  useEffect(() => {
    void cargarTasas({ silent: Boolean(data) });
  }, []);

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
  }, [data]);

  useEffect(() => {
    if (gruposMoneda.length === 0) return;
    if (!gruposMoneda.some((grupo) => grupo.moneda === monedaSeleccionada)) {
      setMonedaSeleccionada(gruposMoneda[0].moneda);
      setMonedaMenuOpen(false);
    }
  }, [gruposMoneda, monedaSeleccionada]);

  const grupoActivo = gruposMoneda.find((grupo) => grupo.moneda === monedaSeleccionada) ?? gruposMoneda[0];
  const promocionesCarrusel = useMemo<PromoBanner[]>(() => (data?.promociones ?? []).map((promocion) => ({
    id: String(promocion.id),
    image: apiAssetUrl(promocion.imagen_url),
    alt: promocion.descripcion,
    body: promocion.descripcion,
  })), [data?.promociones]);

  return (
    <section className="home-page">
      <HeroCarousel grupo={grupoActivo} generatedAt={data?.sync?.last_success_at ?? data?.generated_at} loading={loading} syncing={syncing} canSyncTasas={canSyncTasas} onRefresh={actualizarTasas} onCreate={onCreate} promos={promocionesCarrusel} />

      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {!error && !loading && data && gruposMoneda.length === 0 && (
        <DismissibleNotice className="notice warning">No hay tasas activas configuradas</DismissibleNotice>
      )}

      {loading && !data && <PageLoader label="Cargando tasas" inline />}

      {grupoActivo && (
        <div className="rates-currency-sections">
          <section className="rates-currency-section" key={grupoActivo.moneda}>
            <header className="rates-currency-header operation-currency-header">
              <div className="operation-currency-copy">
                <h3>Moneda de Recepcion:</h3>
                <p>{etiquetaMoneda(grupoActivo.moneda)}</p>
              </div>
              <div className={monedaMenuOpen ? 'currency-picker-wrap open' : 'currency-picker-wrap'}>
                {monedaMenuOpen && <button className="currency-picker-backdrop" type="button" aria-label="Cerrar selector de moneda" onClick={() => setMonedaMenuOpen(false)} />}
                <button
                  className="currency-picker currency-picker-button"
                  type="button"
                  onClick={() => setMonedaMenuOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={monedaMenuOpen}
                >
                  <span className="currency-picker-flag" aria-hidden="true">{banderaMoneda(monedaSeleccionada)}</span>
                  <strong>{nombreMoneda(monedaSeleccionada)}</strong>
                  <ChevronDown size={16} />
                </button>
                {monedaMenuOpen && (
                  <div className="currency-picker-menu" role="menu" aria-label="Tipo de moneda">
                    {gruposMoneda.map((grupo) => (
                      <button
                        key={grupo.moneda}
                        type="button"
                        role="menuitemradio"
                        aria-checked={monedaSeleccionada === grupo.moneda}
                        className={monedaSeleccionada === grupo.moneda ? 'active' : ''}
                        onClick={() => { setMonedaSeleccionada(grupo.moneda); setMonedaMenuOpen(false); }}
                      >
                        <span className="currency-picker-flag" aria-hidden="true">{banderaMoneda(grupo.moneda)}</span>
                        <span><strong>{nombreMoneda(grupo.moneda)}</strong><small>{etiquetaMoneda(grupo.moneda)}</small></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </header>

            <CotizadorVivo grupo={grupoActivo} />

            <section className="home-services-section" aria-label="Servicios disponibles">
              <div className="rates-grid operational-rates-grid">
              {serviceCards.map((card) => {
                const esSaldo = card.servicio === 'saldo';
                const esDivisa = card.servicio === 'divisa';
                const ofertas = esDivisa || esSaldo ? [] : ofertasServicio(grupoActivo.ofertas, card.servicio);
                const ofertasDivisa = grupoActivo.ofertasDivisa;
                const paquetesSaldo = grupoActivo.paquetesSaldo;
                const tieneDatos = esSaldo ? paquetesSaldo.length > 0 : esDivisa ? ofertasDivisa.length > 0 : ofertas.length > 0;

                return (
                  <article className={`rate-card operation-rate-card ${card.tone} ${card.servicio}`} key={`${grupoActivo.moneda}-${card.servicio}`}>
                    <header className="rate-card-header operation-rate-card-header">
                      <span className="rate-icon">{card.icon}</span>
                      <span>
                        <h3>{card.title}</h3>
                        <small>{card.subtitle}</small>
                      </span>
                      <strong className={tieneDatos ? 'rate-state active' : 'rate-state'}>{tieneDatos ? 'Activa' : 'Sin tasa'}</strong>
                    </header>

                    {!tieneDatos ? (
                      <div className="rate-lines">
                        <p className="rate-empty-state">Sin ofertas activas para {nombreMoneda(grupoActivo.moneda)}</p>
                      </div>
                    ) : esSaldo ? (
                      <div className="rate-packages">
                        {paquetesSaldo.slice(0, 3).map((paquete) => (
                          <button
                            type="button"
                            className="rate-package-option"
                            key={paquete.id}
                            onClick={() => onCreate('saldo', { moneda_pago: monedaPago(paquete.moneda_pago ?? grupoActivo.moneda), paquete_saldo_id: String(paquete.id) })}
                          >
                            <span className="package-balance">
                              <small>Recibe</small>
                              <strong>{formatNumber(paquete.saldo_cup)}</strong>
                              <em>CUP</em>
                            </span>
                            <span className="package-price">{formatNumber(paquete.monto_pago)} {monedaPago(paquete.moneda_pago ?? grupoActivo.moneda)}</span>
                          </button>
                        ))}
                      </div>
                    ) : esDivisa ? (
                      <div className="rate-packages divisa-rate-packages">
                        {ofertasDivisa.slice(0, 3).map((oferta) => (
                          <button
                            type="button"
                            className="rate-package-option divisa-package-option"
                            key={oferta.id}
                            onClick={() => onCreate('divisa', {
                              monto_pago: String(oferta.minimo_pago ?? ''),
                              moneda_pago: monedaPago(oferta.moneda_pago ?? grupoActivo.moneda),
                              tipo_tarjeta: tipoTarjetaDesdeOferta(oferta),
                            })}
                          >
                            <span className="package-balance">
                              <small>{etiquetaDivisa(oferta)}</small>
                              <strong>{formatNumber(oferta.tasa)}</strong>
                              <em>= {formatNumber(oferta.minimo_pago ?? 0)} {monedaPago(oferta.moneda_pago ?? grupoActivo.moneda)}</em>
                            </span>
                            <span className="package-price">Comprar</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <RateTierRows
                        ofertas={ofertas}
                        moneda={monedaPago(grupoActivo.moneda)}
                        servicio={card.servicio}
                        onCreate={onCreate}
                      />
                    )}

                    <button className="primary-button rate-action" onClick={() => onCreate(card.servicio, { moneda_pago: grupoActivo.moneda })} disabled={!tieneDatos}>
                      Crear {card.servicio}
                    </button>
                  </article>
                );
              })}
              </div>
            </section>
          </section>
        </div>
      )}

      <section className="home-tracking-section" aria-label="Rastreo de pedidos">
        <TrackOrderPanel onTrackPedido={onTrackPedido} />
      </section>
    </section>
  );
}
