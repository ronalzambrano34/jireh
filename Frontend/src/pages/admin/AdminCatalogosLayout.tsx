import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronDown, RefreshCw, Settings2 } from 'lucide-react';

export type AdminEstadoVista = 'activos' | 'inactivos';

export type AdminMenuItem<T extends string> = {
  tema: T;
  titulo: string;
  resumen: string;
  icono: LucideIcon;
};

export type AdminMenuGroup<T extends string> = {
  titulo: string;
  items: AdminMenuItem<T>[];
};

type AdminHeroProps = {
  titulo: string;
  subtitulo: string;
  loading: boolean;
  detail: boolean;
  onBack: () => void;
  onRefresh: () => void;
};

export function AdminHero({ titulo, subtitulo, loading, detail, onBack, onRefresh }: AdminHeroProps) {
  return (
    <div className="admin-hero-card">
      <div className="admin-hero-main">
        {detail ? (
          <button className="icon-button" type="button" onClick={onBack} title="Volver a administracion" aria-label="Volver a administracion">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="admin-hero-icon"><Settings2 size={24} /></div>
        )}
        <div>
          <h2>{titulo}</h2>
          <p>{loading ? 'Actualizando...' : subtitulo}</p>
        </div>
        {detail && (
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} title={`Actualizar ${titulo.toLowerCase()}`} aria-label={`Actualizar ${titulo.toLowerCase()}`}>
            <RefreshCw size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminMenu<T extends string>({ groups, onOpen }: { groups: AdminMenuGroup<T>[]; onOpen: (tema: T) => void }) {
  return (
    <div className="admin-menu-grid">
      {groups.map((group) => (
        <section className="profile-section admin-menu-section" key={group.titulo}>
          <h3>{group.titulo}</h3>
          {group.items.map(({ tema, titulo, resumen, icono: Icon }) => (
            <button className="profile-option admin-topic-option" type="button" onClick={() => onOpen(tema)} key={tema}>
              <Icon size={22} />
              <span><strong>{titulo}</strong><small>{resumen}</small></span>
              <ChevronDown size={18} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

type AdminSectionProps = {
  icono: LucideIcon;
  titulo: string;
  resumen: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export function AdminSection({ icono: Icon, titulo, resumen, action, children }: AdminSectionProps) {
  return (
    <section className="admin-section admin-detail-section">
      <header className="admin-section-header">
        <span className="admin-section-icon"><Icon size={22} /></span>
        <div>
          <h3>{titulo}</h3>
          <small>{resumen}</small>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

type AdminStateSwitchProps = {
  value: AdminEstadoVista;
  onChange: (value: AdminEstadoVista) => void;
  feminine?: boolean;
  ariaLabel?: string;
};

export function AdminStateSwitch({ value, onChange, feminine = false, ariaLabel = 'Vista de registros' }: AdminStateSwitchProps) {
  return (
    <div className="admin-state-switch" role="group" aria-label={ariaLabel}>
      <button type="button" className={value === 'activos' ? 'active' : ''} onClick={() => onChange('activos')}>
        {feminine ? 'Activas' : 'Activos'}
      </button>
      <button type="button" className={value === 'inactivos' ? 'active' : ''} onClick={() => onChange('inactivos')}>
        {feminine ? 'Inactivas' : 'Inactivos'}
      </button>
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty-row">{children}</div>;
}
