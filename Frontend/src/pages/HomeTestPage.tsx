import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import {
  ArrowRight,
  Banknote,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { apiAssetUrl, obtenerPedido, obtenerTasasOperativas, rastrearPedidosPorCliente, sincronizarOfertas } from '../api/client';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { FloatingSelect } from '../components/FloatingSelect';
import { PageLoader } from '../components/PageLoader';
import { UiSwitch } from '../components/UiSwitch';
import type { OfertaOperativa, PaqueteSaldoOperativo, PedidoResumen, TasaOperativaResponse } from '../types/api';
import { banderaMoneda, nombreMoneda } from '../utils/monedas';
import type { InicioCreateDraft, InicioServicio } from './inicio/ServicesRatesGrid';
import './home-test/HomeTestPage.css';
import logoJireh from '../assets/brand/logo-jireh.jpeg';
import tasasBanner from '../assets/brand/banner-jireh.jpeg';

type HomeTestPageProps = {
  canSyncTasas?: boolean;
  onCreate: (servicio: InicioServicio, draft?: InicioCreateDraft) => void;
  onTrackPedido: (codigo: string) => void;
};

type CurrencyGroup = {
  moneda: string;
  ofertas: OfertaOperativa[];
  divisas: OfertaOperativa[];
  paquetes: PaqueteSaldoOperativo[];
};

const CACHE_KEY = 'jireh.tasas-operativas.cache';
const formatNumber = (value: number | string | null | undefined) => new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
const normalizeCurrency = (value?: string | null) => (value || 'BRL').trim().toUpperCase();
const minimum = (offer: OfertaOperativa) => Number(offer.minimo_pago ?? 0);
const rate = (offer?: OfertaOperativa) => Number(offer?.tasa ?? 0);

function updateLabel(value?: string | null) {
  if (!value) return 'Actualizado ahora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Actualizado ahora';
  return `Actualizado ${date.toLocaleDateString('es-UY')} ${date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
}

function readCache() {
  try {
    const value = localStorage.getItem(CACHE_KEY);
    return value ? JSON.parse(value) as TasaOperativaResponse : null;
  } catch {
    return null;
  }
}

function bestOffer(offers: OfertaOperativa[], amount: number) {
  const sorted = [...offers].sort((a, b) => minimum(a) - minimum(b));
  return [...sorted].reverse().find((offer) => amount >= minimum(offer)) ?? sorted[0];
}

function serviceOffers(group: CurrencyGroup, service: string) {
  return group.ofertas.filter((offer) => offer.servicio === service).sort((a, b) => minimum(a) - minimum(b));
}

function ServiceIcon({ service }: { service: InicioServicio }) {
  const icons: Record<InicioServicio, ReactNode> = {
    transferencia: <WalletCards size={22} />,
    efectivo: <Banknote size={22} />,
    saldo: <Smartphone size={22} />,
    divisa: <WalletCards size={22} />,
  };
  return icons[service];
}

function HomeTestCarousel({
  data,
  group,
  loading,
  syncing,
  canSync,
  onRefresh,
  onCreate,
}: {
  data: TasaOperativaResponse | null;
  group?: CurrencyGroup;
  loading: boolean;
  syncing: boolean;
  canSync: boolean;
  onRefresh: () => void;
  onCreate: HomeTestPageProps['onCreate'];
}) {
  const transfer = serviceOffers(group ?? { moneda: 'BRL', ofertas: [], divisas: [], paquetes: [] }, 'transferencia')[0];
  const cash = serviceOffers(group ?? { moneda: 'BRL', ofertas: [], divisas: [], paquetes: [] }, 'efectivo')[0];
  const currency = group?.moneda ?? 'BRL';
  const configuredSlides = (data?.promociones ?? []).map((slide) => {
    if (slide.tipo === 'precios') {
      return {
        key: `slide-${slide.id}`,
        className: 'precios',
        content: (
          <div className="ht-config-slide ht-price-slide">
            <span className="ht-eyebrow">{slide.subtitulo}</span>
            <h2>{slide.titulo}</h2>
            {slide.descripcion && <p>{slide.descripcion}</p>}
            <div className="ht-price-pair">
              <button type="button" onClick={() => onCreate('transferencia', { moneda_pago: currency, monto_pago: String(transfer?.minimo_pago ?? '') })}>
                <small>Transferencia</small>
                <strong><span>1 {currency} =</span><b>{transfer ? formatNumber(transfer.tasa) : '-'} CUP</b></strong>
                <em>Crear orden</em>
              </button>
              <button type="button" onClick={() => onCreate('efectivo', { moneda_pago: currency, monto_pago: String(cash?.minimo_pago ?? '') })}>
                <small>Efectivo</small>
                <strong><span>1 {currency} =</span><b>{cash ? formatNumber(cash.tasa) : '-'} CUP</b></strong>
                <em>Crear orden</em>
              </button>
            </div>
          </div>
        ),
      };
    }

    if (slide.tipo === 'marca') {
      return {
        key: `slide-${slide.id}`,
        className: 'marca',
        content: (
          <div className="ht-config-slide ht-brand-slide">
            <img src={slide.imagen_url ? apiAssetUrl(slide.imagen_url) : logoJireh} alt={slide.subtitulo || 'El Jireh'} />
            <span>
              <span className="ht-eyebrow">{slide.subtitulo}</span>
              <h2>{slide.titulo}</h2>
              {slide.descripcion && <p>{slide.descripcion}</p>}
              <small>{updateLabel(data?.sync?.last_success_at ?? data?.generated_at)}</small>
            </span>
          </div>
        ),
      };
    }

    return {
      key: `slide-${slide.id}`,
      className: 'promotion',
      content: (
        <div className="ht-promotion-slide">
          <img src={apiAssetUrl(slide.imagen_url)} alt={slide.titulo} />
          <span className="ht-promotion-copy">
            {slide.subtitulo && <span className="ht-eyebrow">{slide.subtitulo}</span>}
            <h2>{slide.titulo}</h2>
            {slide.descripcion && <p>{slide.descripcion}</p>}
          </span>
        </div>
      ),
    };
  });
  const slides = configuredSlides.length ? configuredSlides : [{
    key: 'empty',
    className: 'empty',
    content: <div className="ht-config-slide"><span className="ht-eyebrow"><Sparkles size={14} /> Carrusel</span><h2>Configura tus slides desde Administracion.</h2></div>,
  }];
  const [active, setActive] = useState(0);
  const [touching, setTouching] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  function move(direction: 1 | -1) {
    if (slides.length < 2) return;
    setActive((current) => (current + direction + slides.length) % slides.length);
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    setTouching(true);
    swipedRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    swipedRef.current = true;
    move(deltaX < 0 ? 1 : -1);
    touchStartRef.current = null;
  }

  function handleTouchEnd() {
    setTouching(false);
    touchStartRef.current = null;
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    if (touching || slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 9000);
    return () => window.clearInterval(timer);
  }, [slides.length, touching]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [active, slides.length]);

  return (
    <section
      className="ht-carousel"
      aria-label="Novedades y tasas destacadas"
      onClickCapture={handleClickCapture}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <img className="ht-carousel-bg" src={tasasBanner} alt="" aria-hidden="true" />
      <div className={`ht-carousel-slide ${slides[active].className}`} key={slides[active].key}>{slides[active].content}</div>
      <button className="ht-carousel-edge previous" type="button" onClick={() => move(-1)} aria-label="Diapositiva anterior" />
      <button className="ht-carousel-edge next" type="button" onClick={() => move(1)} aria-label="Diapositiva siguiente" />
      <div className="ht-carousel-dots">
        {slides.map((slide, index) => <button key={slide.key} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Ver diapositiva ${index + 1}`} />)}
      </div>
      {canSync && (
        <button className="ht-sync-button" type="button" onClick={onRefresh} disabled={loading || syncing}>
          <RefreshCw size={16} /> {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      )}
    </section>
  );
}

function QuotePanel({ group }: { group: CurrencyGroup }) {
  const [amount, setAmount] = useState('');
  const numericAmount = Number(amount.replace(',', '.')) || 0;
  const transfer = bestOffer(serviceOffers(group, 'transferencia'), numericAmount);
  const cash = bestOffer(serviceOffers(group, 'efectivo'), numericAmount);

  return (
    <section className="ht-panel ht-quote-panel">
      <header className="ht-section-heading">
        <span><Calculator size={21} /></span>
        <div><small>Cotizador en vivo</small><h3>Compara antes de crear</h3><p>El sistema aplica automáticamente la tasa correspondiente al monto.</p></div>
      </header>
      <div className="ht-quote-layout">
        <label className="ht-amount-field">
          <span>¿Cuánto quieres enviar?</span>
          <div>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Escribe el monto a enviar"
              aria-label={`Monto a enviar en ${group.moneda}`}
            />
            <strong>{group.moneda}</strong>
          </div>
          {/* <small>Los resultados se calculan mientras escribes.</small> */}
        </label>
        <div className="ht-quote-results">
          <article><small>Transferencia</small><strong>{formatNumber(numericAmount * rate(transfer))} <em>CUP</em></strong><span>1 {group.moneda} = {transfer ? formatNumber(transfer.tasa) : '-'} CUP</span></article>
          <article><small>Efectivo</small><strong>{formatNumber(numericAmount * rate(cash))} <em>CUP</em></strong><span>1 {group.moneda} = {cash ? formatNumber(cash.tasa) : '-'} CUP</span></article>
        </div>
      </div>
    </section>
  );
}

function OfferCard({ service, group, onCreate }: { service: InicioServicio; group: CurrencyGroup; onCreate: HomeTestPageProps['onCreate'] }) {
  const [showRepeated, setShowRepeated] = useState(false);
  const config = {
    transferencia: { title: 'Transferencias', description: 'Envio directo a cuenta o tarjeta.' },
    efectivo: { title: 'Efectivo', description: 'Entrega coordinada en mano.' },
    saldo: { title: 'Saldo movil', description: 'Paquetes de recarga disponibles.' },
    divisa: { title: 'Tarjetas en divisa', description: 'Opciones MLC, USD y Clasica.' },
  }[service];
  const offers = service === 'divisa' ? group.divisas : serviceOffers(group, service);
  const supportsRepeatedRates = service === 'transferencia' || service === 'efectivo';
  const visibleOffers = supportsRepeatedRates && !showRepeated
    ? offers.filter((offer, index) => index === 0 || rate(offer) !== rate(offers[index - 1]))
    : offers;
  const hasData = service === 'saldo' ? group.paquetes.length > 0 : offers.length > 0;

  return (
    <article className={`ht-offer-card ${service}`}>
      <header>
        <span className="ht-offer-icon"><ServiceIcon service={service} /></span>
        <div className="ht-offer-copy">
          <div className="ht-offer-title">
            <h3>{config.title}</h3>
            <small>{group.moneda} → destino</small>
          </div>
          <p>{config.description}</p>
        </div>
        <div className="ht-offer-meta">
          <em>{service === 'saldo' ? group.paquetes.length : offers.length} opciones</em>
          {supportsRepeatedRates && (
            <label>
              <span>Repetidas</span>
              <UiSwitch checked={showRepeated} onChange={setShowRepeated} ariaLabel={`Mostrar tasas repetidas de ${config.title}`} />
            </label>
          )}
        </div>
      </header>
      <div className="ht-offer-list" tabIndex={hasData ? 0 : undefined}>
        {service === 'saldo' && group.paquetes.map((pack) => (
          <button type="button" key={pack.id} onClick={() => onCreate('saldo', { moneda_pago: group.moneda, paquete_saldo_id: String(pack.id) })}>
            <span><small>Recibe</small><strong>{formatNumber(pack.saldo_cup)} CUP</strong></span><b>{formatNumber(pack.monto_pago)} {group.moneda}</b><ArrowRight size={16} />
          </button>
        ))}
        {service === 'divisa' && visibleOffers.map((offer) => (
          <button type="button" key={offer.id} onClick={() => onCreate('divisa', { moneda_pago: group.moneda, monto_pago: String(offer.minimo_pago ?? ''), tipo_tarjeta: offer.servicio === 'usd' ? 'USD' : offer.servicio === 'clasica' ? 'OTRA' : 'MLC' })}>
            <span><small>{offer.nombre || offer.servicio.toUpperCase()}</small><strong>{formatNumber(offer.tasa)} {offer.servicio.toUpperCase()}</strong></span><b>{formatNumber(offer.minimo_pago)} {group.moneda}</b><ArrowRight size={16} />
          </button>
        ))}
        {(service === 'transferencia' || service === 'efectivo') && visibleOffers.map((offer, index) => {
          const next = visibleOffers[index + 1];
          return (
            <button type="button" key={offer.id} onClick={() => onCreate(service, { moneda_pago: group.moneda, monto_pago: String(offer.minimo_pago || '') })}>
              <span><small>{next ? `Menos de ${formatNumber(next.minimo_pago)}` : `Desde ${formatNumber(offer.minimo_pago)}`} {group.moneda}</small><strong>{formatNumber(offer.tasa)} CUP</strong></span><b>Seleccionar</b><ArrowRight size={16} />
            </button>
          );
        })}
        {!hasData && <p className="ht-empty-offer">No hay opciones activas para esta moneda.</p>}
      </div>
      <button className="ht-create-service" type="button" disabled={!hasData} onClick={() => onCreate(service, { moneda_pago: group.moneda })}>
        Enviar en {config.title.toLowerCase()} <ArrowRight size={17} />
      </button>
    </article>
  );
}

function HomeTestTracker({ onTrackPedido }: { onTrackPedido: (code: string) => void }) {
  const [term, setTerm] = useState('');
  const [orders, setOrders] = useState<PedidoResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = term.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const result = /^\d+$/.test(clean) ? await rastrearPedidosPorCliente(Number(clean)) : [await obtenerPedido(clean.toUpperCase())];
      setOrders(result);
      if (!result.length) setError('No se encontraron pedidos activos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rastrear el pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ht-panel ht-tracker">
      <header className="ht-section-heading"><span><ClipboardList size={21} /></span><div><h3>Rastrea un pedido</h3><p>Busca por codigo de operacion o numero de cliente.</p></div></header>
      <form onSubmit={submit}><label><Search size={18} /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ej. JH-3204-CUBA o 125" /></label><button type="submit" disabled={!term.trim() || loading}>{loading ? 'Buscando...' : 'Rastrear'}</button></form>
      {error && <div className="ht-tracker-error">{error}</div>}
      {orders.map((order) => (
        <article className="ht-tracker-result" key={order.codigo_operacion}>
          <span><Clock3 size={18} /><small>Estado</small><strong>{order.estado.replaceAll('_', ' ')}</strong></span>
          <span><CheckCircle2 size={18} /><small>Codigo</small><strong>{order.codigo_operacion}</strong></span>
          <button type="button" onClick={() => onTrackPedido(order.codigo_operacion)}>Abrir detalle <ArrowRight size={16} /></button>
        </article>
      ))}
    </section>
  );
}

export function HomeTestPage({ canSyncTasas = false, onCreate, onTrackPedido }: HomeTestPageProps) {
  const [data, setData] = useState<TasaOperativaResponse | null>(() => readCache());
  const [currency, setCurrency] = useState('BRL');
  const [loading, setLoading] = useState(!data);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await obtenerTasasOperativas();
      setData(response);
      localStorage.setItem(CACHE_KEY, JSON.stringify(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasas');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setSyncing(true);
    setError(null);
    try {
      if (canSyncTasas) await sincronizarOfertas();
      await load(true);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load(Boolean(data));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CurrencyGroup>();
    const get = (value?: string | null) => {
      const key = normalizeCurrency(value);
      if (!map.has(key)) map.set(key, { moneda: key, ofertas: [], divisas: [], paquetes: [] });
      return map.get(key) as CurrencyGroup;
    };
    for (const offer of data?.ofertas ?? []) get(offer.moneda_pago).ofertas.push(offer);
    for (const offer of data?.ofertas_divisa ?? []) get(offer.moneda_pago).divisas.push(offer);
    for (const pack of data?.paquetes_saldo ?? []) get(pack.moneda_pago).paquetes.push(pack);
    return [...map.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
  }, [data]);

  useEffect(() => {
    if (groups.length && !groups.some((group) => group.moneda === currency)) setCurrency(groups[0].moneda);
  }, [currency, groups]);

  const activeGroup = groups.find((group) => group.moneda === currency) ?? groups[0];

  return (
    <section className="home-test-page app-page-width">
      <HomeTestCarousel data={data} group={activeGroup} loading={loading} syncing={syncing} canSync={canSyncTasas} onRefresh={() => void refresh()} onCreate={onCreate} />
      {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
      {loading && !data && <PageLoader label="Cargando tasas" inline />}
      {activeGroup && (
        <>
          <section className="ht-currency-bar">
            <div><span className="ht-eyebrow">Moneda de pago</span><h3>{banderaMoneda(currency)} {nombreMoneda(currency)}</h3><p>Todos los cálculos y ofertas se muestran en {currency}.</p></div>
            <FloatingSelect
              className="ht-currency-select"
              buttonClassName="ht-currency-select-button"
              menuClassName="ht-currency-select-menu"
              value={currency}
              onChange={setCurrency}
              ariaLabel="Seleccionar moneda de pago"
              align="right"
              options={groups.map((group) => ({
                value: group.moneda,
                label: `${group.moneda} · ${nombreMoneda(group.moneda)}`,
                description: `Mostrar tasas y ofertas en ${group.moneda}`,
                icon: <span className="ht-currency-flag" aria-hidden="true">{banderaMoneda(group.moneda)}</span>,
              }))}
            />
          </section>
          <QuotePanel group={activeGroup} />
          <section className="ht-services-section">
            <header><span className="ht-eyebrow">Servicios disponibles</span><h2>Elige cómo quieres operar</h2><p>Cada opción muestra sus tasas y paquetes de forma directa.</p></header>
            <div className="ht-offers-grid">{(['transferencia', 'efectivo', 'saldo', 'divisa'] as InicioServicio[]).map((service) => <OfferCard key={service} service={service} group={activeGroup} onCreate={onCreate} />)}</div>
          </section>
          <HomeTestTracker onTrackPedido={onTrackPedido} />
        </>
      )}
    </section>
  );
}
