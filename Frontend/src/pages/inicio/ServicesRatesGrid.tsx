import type { ReactNode } from 'react';
import type { OfertaOperativa, PaqueteSaldoOperativo } from '../../types/api';

export type InicioServicio = 'transferencia' | 'efectivo' | 'saldo' | 'divisa';

export type InicioCreateDraft = {
  monto_pago?: string;
  moneda_pago?: string;
  paquete_saldo_id?: string;
  monto_divisa?: string;
  tipo_tarjeta?: string;
};

export type InicioServiceCard = {
  servicio: InicioServicio;
  title: string;
  subtitle: string;
  tone: string;
  icon: ReactNode;
};

type ServicesRatesGridProps = {
  moneda: string;
  ofertas: OfertaOperativa[];
  ofertasDivisa: OfertaOperativa[];
  paquetesSaldo: PaqueteSaldoOperativo[];
  cards: InicioServiceCard[];
  onCreate: (servicio: InicioServicio, draft?: InicioCreateDraft) => void;
  ofertasServicio: (ofertas: OfertaOperativa[], servicio: InicioServicio) => OfertaOperativa[];
  monedaPago: (moneda?: string | null) => string;
  nombreMoneda: (moneda: string) => string;
  formatNumber: (value: number | string | null | undefined) => string;
  etiquetaDivisa: (oferta: OfertaOperativa) => string;
  tipoTarjetaDesdeOferta: (oferta: OfertaOperativa) => string;
  renderRateRows: (ofertas: OfertaOperativa[], moneda: string, servicio: InicioServicio) => ReactNode;
};

export function ServicesRatesGrid(props: ServicesRatesGridProps) {
  return (
    <section className="home-services-section" aria-label="Servicios disponibles">
      <div className="rates-grid operational-rates-grid">
        {props.cards.map((card) => {
          const esSaldo = card.servicio === 'saldo';
          const esDivisa = card.servicio === 'divisa';
          const ofertas = esDivisa || esSaldo ? [] : props.ofertasServicio(props.ofertas, card.servicio);
          const tieneDatos = esSaldo
            ? props.paquetesSaldo.length > 0
            : esDivisa
              ? props.ofertasDivisa.length > 0
              : ofertas.length > 0;
          const cantidadOpciones = esSaldo ? props.paquetesSaldo.length : esDivisa ? props.ofertasDivisa.length : ofertas.length;

          return (
            <article className={`rate-card operation-rate-card ${card.tone} ${card.servicio}`} key={`${props.moneda}-${card.servicio}`}>
              <header className="rate-card-header operation-rate-card-header">
                <span className="rate-icon">{card.icon}</span>
                <span className="operation-rate-card-copy">
                  <h3>{card.title}</h3>
                  <small>{card.subtitle}</small>
                </span>
                <span className="operation-rate-card-meta">
                  <em className="rate-pair-label">{props.monedaPago(props.moneda)} → CUP</em>
                  <strong className={tieneDatos ? 'rate-state active' : 'rate-state'}>
                    {tieneDatos ? `${cantidadOpciones} ${cantidadOpciones === 1 ? 'opcion' : 'opciones'}` : 'Sin tasa'}
                  </strong>
                </span>
              </header>

              {!tieneDatos ? (
                <div className="rate-lines">
                  <p className="rate-empty-state">Sin ofertas activas para {props.nombreMoneda(props.moneda)}</p>
                </div>
              ) : esSaldo ? (
                <div className="rate-packages">
                  {props.paquetesSaldo.slice(0, 3).map((paquete) => (
                    <button type="button" className="rate-package-option" key={paquete.id} onClick={() => props.onCreate('saldo', { moneda_pago: props.monedaPago(paquete.moneda_pago ?? props.moneda), paquete_saldo_id: String(paquete.id) })}>
                      <span className="package-balance"><small>Recibe</small><strong>{props.formatNumber(paquete.saldo_cup)}</strong><em>CUP</em></span>
                      <span className="package-price">{props.formatNumber(paquete.monto_pago)} {props.monedaPago(paquete.moneda_pago ?? props.moneda)}</span>
                    </button>
                  ))}
                </div>
              ) : esDivisa ? (
                <div className="rate-packages divisa-rate-packages">
                  {props.ofertasDivisa.slice(0, 3).map((oferta) => (
                    <button type="button" className="rate-package-option divisa-package-option" key={oferta.id} onClick={() => props.onCreate('divisa', {
                      monto_pago: String(oferta.minimo_pago ?? ''),
                      moneda_pago: props.monedaPago(oferta.moneda_pago ?? props.moneda),
                      tipo_tarjeta: props.tipoTarjetaDesdeOferta(oferta),
                    })}>
                      <span className="package-balance">
                        <small>{props.etiquetaDivisa(oferta)}</small>
                        <strong>{props.formatNumber(oferta.tasa)}</strong>
                        <em>= {props.formatNumber(oferta.minimo_pago ?? 0)} {props.monedaPago(oferta.moneda_pago ?? props.moneda)}</em>
                      </span>
                      <span className="package-price">Comprar</span>
                    </button>
                  ))}
                </div>
              ) : (
                props.renderRateRows(ofertas, props.monedaPago(props.moneda), card.servicio)
              )}

              <button className="primary-button rate-action" onClick={() => props.onCreate(card.servicio, { moneda_pago: props.moneda })} disabled={!tieneDatos}>
                Crear {card.servicio}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
