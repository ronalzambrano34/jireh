import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Banknote, RefreshCw, Smartphone, WalletCards } from 'lucide-react';
import { obtenerTasasOperativas } from '../api/client';
import type { OfertaOperativa, PaqueteSaldoOperativo, TasaOperativaResponse } from '../types/api';
import logoJireh from '../assets/brand/logo-jireh.jpeg';
import tasasBanner from '../assets/brand/banner-jireh.jpeg';

type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa';

type InicioPageProps = {
  onCreate: (servicio: ServicioCrear) => void;
};

type ServiceCard = {
  servicio: ServicioCrear;
  title: string;
  subtitle: string;
  tone: string;
  icon: ReactNode;
};

const serviceCards: ServiceCard[] = [
  {
    servicio: 'transferencia',
    title: 'Transferencias a Cuba',
    subtitle: 'Envio de dinero directo',
    tone: 'green',
    icon: <WalletCards size={22} />,
  },
  {
    servicio: 'efectivo',
    title: 'Efectivo en mano',
    subtitle: 'Entrega local en Cuba',
    tone: 'blue',
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

function ofertasServicio(ofertas: OfertaOperativa[], servicio: ServicioCrear) {
  return ofertas
    .filter((oferta) => oferta.servicio === servicio)
    .sort((a, b) => Number(a.minimo_pago ?? 0) - Number(b.minimo_pago ?? 0));
}

function ofertaBase(ofertas: OfertaOperativa[]) {
  return ofertas.find((oferta) => Number(oferta.minimo_pago ?? 0) <= 0) ?? ofertas[0];
}

function ofertaVolumen(ofertas: OfertaOperativa[]) {
  return [...ofertas]
    .filter((oferta) => Number(oferta.minimo_pago ?? 0) > 0)
    .sort((a, b) => Number(a.minimo_pago ?? 0) - Number(b.minimo_pago ?? 0))[0];
}

function fechaActualizacion(value?: string) {
  if (!value) return 'Actualizado ahora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Actualizado ahora';
  return `Actualizado ${date.toLocaleDateString('es-UY')} ${date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`;
}

export function InicioPage({ onCreate }: InicioPageProps) {
  const [data, setData] = useState<TasaOperativaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarTasas() {
    setLoading(true);
    setError(null);
    try {
      setData(await obtenerTasasOperativas());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tasas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarTasas();
  }, []);

  const paquetesSaldo = useMemo(() => {
    return [...(data?.paquetes_saldo ?? [])].sort((a: PaqueteSaldoOperativo, b: PaqueteSaldoOperativo) => Number(a.monto_pago) - Number(b.monto_pago));
  }, [data]);

  return (
    <section className="home-page">
      <div className="rates-hero">
        <img className="rates-hero-bg" src={tasasBanner} alt="Jireh Remesas tasa de cambio" />
        <div className="rates-hero-content">
          <img className="rates-logo" src={logoJireh} alt="El Jireh" />
          <div>
            <h2>Tasas del dia</h2>
            <p>{fechaActualizacion(data?.generated_at)}</p>
          </div>
          <button className="ghost-button hero-refresh" onClick={cargarTasas} disabled={loading}>
            <RefreshCw size={17} /> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {!error && !loading && data && data.ofertas.length === 0 && paquetesSaldo.length === 0 && (
        <div className="notice warning">No hay tasas activas configuradas</div>
      )}

      <div className="rates-grid">
        {serviceCards.map((card) => {
          const ofertas = ofertasServicio(data?.ofertas ?? [], card.servicio);
          const base = ofertaBase(ofertas);
          const volumen = ofertaVolumen(ofertas);
          const tieneDatos = card.servicio === 'saldo' ? paquetesSaldo.length > 0 : Boolean(base);

          return (
            <article className={`rate-card ${card.tone}`} key={card.servicio}>
              <header className="rate-card-header">
                <span className="rate-icon">{card.icon}</span>
                <span>
                  <h3>{card.title}</h3>
                  <small>{card.subtitle}</small>
                </span>
                <strong className={tieneDatos ? 'rate-state active' : 'rate-state'}>{tieneDatos ? 'Activa' : 'Sin tasa'}</strong>
              </header>

              {card.servicio === 'saldo' ? (
                <div className="rate-packages">
                  {paquetesSaldo.slice(0, 4).map((paquete) => (
                    <div key={paquete.id}>
                      <span>{formatNumber(paquete.saldo_cup)} saldo</span>
                      <strong>{formatNumber(paquete.monto_pago)} {paquete.moneda_pago ?? 'BRL'}</strong>
                    </div>
                  ))}
                  {paquetesSaldo.length === 0 && <p>No hay paquetes activos</p>}
                </div>
              ) : (
                <div className="rate-lines">
                  <div className="rate-line primary">
                    <span>1 {base?.moneda_pago ?? 'BRL'}</span>
                    <ArrowRight size={18} />
                    <strong>{base ? `${formatNumber(base.tasa)} CUP` : '-'}</strong>
                  </div>
                  <div className="rate-line">
                    <span>{volumen ? `${formatNumber(volumen.minimo_pago)}+ ${volumen.moneda_pago ?? 'BRL'}` : 'Volumen'}</span>
                    <ArrowRight size={17} />
                    <strong>{volumen ? `${formatNumber(volumen.tasa)} CUP` : '-'}</strong>
                  </div>
                </div>
              )}

              <button className="primary-button rate-action" onClick={() => onCreate(card.servicio)} disabled={!tieneDatos}>
                Crear {card.servicio}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
