import { ArrowRight, Banknote, Smartphone, Sparkles, WalletCards } from 'lucide-react';
import { InicioPage } from './InicioPage';
import type { InicioCreateDraft, InicioServicio } from './inicio/ServicesRatesGrid';
import './home-test/HomeTestPage.css';

type HomeTestPageProps = {
  canSyncTasas?: boolean;
  onCreate: (servicio: InicioServicio, draft?: InicioCreateDraft) => void;
  onTrackPedido: (codigo: string) => void;
};

const quickActions = [
  {
    servicio: 'transferencia' as const,
    label: 'Transferencia',
    detail: 'A cuentas y tarjetas',
    icon: <WalletCards size={21} />,
  },
  {
    servicio: 'efectivo' as const,
    label: 'Efectivo',
    detail: 'Entrega en mano',
    icon: <Banknote size={21} />,
  },
  {
    servicio: 'saldo' as const,
    label: 'Saldo movil',
    detail: 'Recarga inmediata',
    icon: <Smartphone size={21} />,
  },
];

export function HomeTestPage({ canSyncTasas = false, onCreate, onTrackPedido }: HomeTestPageProps) {
  return (
    <section className="home-test-page">
      <header className="home-test-welcome">
        <div className="home-test-welcome-copy">
          <span className="home-test-eyebrow"><Sparkles size={15} /> Nueva experiencia</span>
          <h2>Todo lo que necesitas para operar, en un solo lugar.</h2>
          <p>Consulta tasas, cotiza servicios y crea pedidos con menos pasos.</p>
        </div>
        <div className="home-test-quick-actions" aria-label="Crear pedido rapido">
          {quickActions.map((action) => (
            <button type="button" key={action.servicio} onClick={() => onCreate(action.servicio)}>
              <span className="home-test-action-icon">{action.icon}</span>
              <span>
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      </header>

      <div className="home-test-content">
        <InicioPage
          canSyncTasas={canSyncTasas}
          onCreate={onCreate}
          onTrackPedido={onTrackPedido}
        />
      </div>
    </section>
  );
}
