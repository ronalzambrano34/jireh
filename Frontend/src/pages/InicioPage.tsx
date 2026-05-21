import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Banknote, RefreshCw, Smartphone, WalletCards } from 'lucide-react';
import { obtenerTasasOperativas } from '../api/client';
import type { OfertaOperativa, PaqueteSaldoOperativo, TasaOperativaResponse } from '../types/api';
import logoJireh from '../assets/brand/logo-jireh.jpeg';
import tasasBanner from '../assets/brand/banner-jireh.jpeg';

type ServicioCrear = 'transferencia' | 'efectivo' | 'saldo' | 'divisa';

type GrupoMoneda = {
  moneda: string;
  ofertas: OfertaOperativa[];
  ofertasDivisa: OfertaOperativa[];
  paquetesSaldo: PaqueteSaldoOperativo[];
};

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

function ofertaBase(ofertas: OfertaOperativa[]) {
  return ofertas.find((oferta) => Number(oferta.minimo_pago ?? 0) <= 0) ?? ofertas[0];
}

function ofertaVolumen(ofertas: OfertaOperativa[]) {
  return [...ofertas]
    .filter((oferta) => Number(oferta.minimo_pago ?? 0) > 0)
    .sort((a, b) => Number(a.minimo_pago ?? 0) - Number(b.minimo_pago ?? 0))[0];
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
      {!error && !loading && data && gruposMoneda.length === 0 && (
        <div className="notice warning">No hay tasas activas configuradas</div>
      )}

      <div className="rates-currency-sections">
        {gruposMoneda.map((grupo) => (
          <section className="rates-currency-section" key={grupo.moneda}>
            <header className="rates-currency-header">
              <div>
                <h3>{etiquetaMoneda(grupo.moneda)}</h3>
                <p>Servicios activos separados por moneda de pago</p>
              </div>
              <strong>{grupo.moneda}</strong>
            </header>

            <div className="rates-grid">
              {serviceCards.map((card) => {
                const esSaldo = card.servicio === 'saldo';
                const esDivisa = card.servicio === 'divisa';
                const ofertas = esDivisa || esSaldo ? [] : ofertasServicio(grupo.ofertas, card.servicio);
                const ofertasDivisa = grupo.ofertasDivisa;
                const paquetesSaldo = grupo.paquetesSaldo;
                const base = ofertaBase(ofertas);
                const volumen = ofertaVolumen(ofertas);
                const tieneDatos = esSaldo ? paquetesSaldo.length > 0 : esDivisa ? ofertasDivisa.length > 0 : Boolean(base);
                if (!tieneDatos) return null;

                return (
                  <article className={`rate-card ${card.tone}`} key={`${grupo.moneda}-${card.servicio}`}>
                    <header className="rate-card-header">
                      <span className="rate-icon">{card.icon}</span>
                      <span>
                        <h3>{card.title}</h3>
                        <small>{card.subtitle}</small>
                      </span>
                      <strong className={tieneDatos ? 'rate-state active' : 'rate-state'}>{tieneDatos ? 'Activa' : 'Sin tasa'}</strong>
                    </header>

                    {esSaldo ? (
                      <div className="rate-packages">
                        {paquetesSaldo.slice(0, 4).map((paquete) => (
                          <div key={paquete.id}>
                            <span>{formatNumber(paquete.saldo_cup)} saldo</span>
                            <strong>{formatNumber(paquete.monto_pago)} {monedaPago(paquete.moneda_pago ?? grupo.moneda)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : esDivisa ? (
                      <div className="rate-lines">
                        {ofertasDivisa.slice(0, 4).map((oferta, index) => (
                          <div className={`rate-line ${index === 0 ? 'primary' : ''}`} key={oferta.id}>
                            <span>{etiquetaLineaDivisa(oferta)}</span>
                            <ArrowRight size={17} />
                            <strong>{formatNumber(oferta.tasa)} {unidadDivisa(oferta)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rate-lines">
                        <div className="rate-line primary">
                          <span>1 {monedaPago(base?.moneda_pago ?? grupo.moneda)}</span>
                          <ArrowRight size={18} />
                          <strong>{base ? `${formatNumber(base.tasa)} CUP` : '-'}</strong>
                        </div>
                        <div className="rate-line">
                          <span>{volumen ? `${formatNumber(volumen.minimo_pago)}+ ${monedaPago(volumen.moneda_pago ?? grupo.moneda)}` : 'Volumen'}</span>
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
        ))}
      </div>
    </section>
  );
}
