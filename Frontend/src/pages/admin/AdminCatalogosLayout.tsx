import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight, Grid2X2, RefreshCw, Settings2 } from 'lucide-react';

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
  descripcion?: string;
  icono?: LucideIcon;
  loading: boolean;
  detail: boolean;
  onBack: () => void;
  onRefresh: () => void;
};

export function AdminHero({ titulo, subtitulo, descripcion, icono: DetailIcon, loading, detail, onBack, onRefresh }: AdminHeroProps) {
  return (
    <div className={`admin-hero-card ${detail ? 'is-detail' : 'is-overview'}`}>
      <div className="admin-hero-main">
        {detail ? (
          <>
            <button className="admin-back-button" type="button" onClick={onBack} title="Volver a administracion" aria-label="Volver a administracion">
              <ArrowLeft size={18} />
            </button>
            <div className="admin-hero-icon admin-detail-hero-icon">
              {DetailIcon ? <DetailIcon size={28} /> : <Settings2 size={28} />}
            </div>
          </>
        ) : (
          <div className="admin-hero-icon"><Settings2 size={26} /></div>
        )}
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">{detail ? subtitulo : 'Centro de control'}</span>
          <h2>{titulo}</h2>
          <p>{loading ? 'Actualizando informacion...' : detail ? descripcion : 'Configura los datos que sostienen la operacion diaria.'}</p>
        </div>
        {detail && (
          <button className="admin-refresh-button" type="button" onClick={onRefresh} disabled={loading} title={`Actualizar ${titulo.toLowerCase()}`} aria-label={`Actualizar ${titulo.toLowerCase()}`}>
            <RefreshCw size={18} />
            <span>Actualizar</span>
          </button>
        )}
        <div className="admin-hero-mark" aria-hidden="true">
          {detail && DetailIcon ? <DetailIcon size={78} strokeWidth={1.1} /> : <Grid2X2 size={70} strokeWidth={1.25} />}
        </div>
      </div>
    </div>
  );
}

export function AdminMenu<T extends string>({ groups, onOpen }: { groups: AdminMenuGroup<T>[]; onOpen: (tema: T) => void }) {
  return (
    <div className="admin-menu-grid">
      {groups.map((group, groupIndex) => (
        <section className="admin-menu-section" key={group.titulo}>
          <header className="admin-menu-heading">
            <span className="admin-menu-number">0{groupIndex + 1}</span>
            <div>
              <h3>{group.titulo}</h3>
              <small>{group.items.length} {group.items.length === 1 ? 'modulo' : 'modulos'}</small>
            </div>
          </header>
          <div className="admin-menu-items">
            {group.items.map(({ tema, titulo, resumen, icono: Icon }) => (
              <button className="admin-topic-option" type="button" onClick={() => onOpen(tema)} key={tema}>
                <span className="admin-topic-icon"><Icon size={20} /></span>
                <span className="admin-topic-copy"><strong>{titulo}</strong><small>{resumen}</small></span>
                <ChevronRight className="admin-topic-arrow" size={18} />
              </button>
            ))}
          </div>
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
        <div className="admin-section-copy">
          <span className="admin-eyebrow">Gestion de registros</span>
          <h3>Registros</h3>
          <small><strong>{resumen}</strong> de {titulo.toLowerCase()}</small>
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
