import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Check, ChevronRight, Settings2 } from 'lucide-react';

export type SetupStep = {
  titulo: string;
  detalle: string;
  icon: LucideIcon;
  listo: boolean;
};

export function SetupHero() {
  return (
    <header className="setup-hero">
      <span><Settings2 size={26} /></span>
      <div>
        <small>Primer inicio</small>
        <h2>Preparemos el sistema para recibir pedidos</h2>
        <p>Completa lo que utiliza tu negocio. Puedes volver y cambiarlo desde Administracion.</p>
      </div>
    </header>
  );
}

export function SetupSteps({ steps, active, onChange }: { steps: SetupStep[]; active: number; onChange: (index: number) => void }) {
  return (
    <nav className="setup-steps" aria-label="Pasos de configuracion">
      {steps.map((item, index) => {
        const Icon = item.icon;
        return (
          <button key={item.titulo} type="button" className={active === index ? 'active' : ''} onClick={() => onChange(index)} aria-current={active === index ? 'step' : undefined}>
            <span className={item.listo ? 'setup-step-icon done' : 'setup-step-icon'}>{item.listo ? <Check size={18} /> : <Icon size={18} />}</span>
            <span><strong>{item.titulo}</strong><small>{item.detalle}</small></span>
            <ChevronRight size={17} />
          </button>
        );
      })}
    </nav>
  );
}

export function SetupCardHeader({ title, description }: { title: string; description: string }) {
  return <header><h3>{title}</h3><p>{description}</p></header>;
}

export function SetupActions({ secondary, primary }: { secondary?: ReactNode; primary: ReactNode }) {
  return <div className="setup-actions">{secondary}{primary}</div>;
}
