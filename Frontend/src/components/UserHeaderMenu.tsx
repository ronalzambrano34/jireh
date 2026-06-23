import { useEffect, useRef, useState } from 'react';
import { Edit3, HelpCircle, LogOut, Moon, Palette, Settings, Sun } from 'lucide-react';
import { apiAssetUrl } from '../api/client';
import type { Operador } from '../types/api';
import '../styles/user-header-menu.css';

type UserHeaderMenuProps = {
  operador: Operador;
  darkTheme: boolean;
  canAdmin: boolean;
  onThemeChange: (dark: boolean) => void;
  onEditProfile: () => void;
  onAppearance: () => void;
  onAdmin: () => void;
  onSupport: () => void;
  onLogout: () => void;
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function UserAvatar({ operador }: { operador: Operador }) {
  if (operador.foto_url) {
    return <img className="user-header-avatar avatar-photo" src={apiAssetUrl(operador.foto_url)} alt="" />;
  }
  return <span className="user-header-avatar">{initials(operador.nombre)}</span>;
}

export function UserHeaderMenu(props: UserHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function close() {
      setOpen(false);
    }

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      close();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      {open && <button className="user-header-backdrop" type="button" aria-label="Cerrar opciones de usuario" onClick={() => setOpen(false)} />}
      <div ref={rootRef} className={open ? 'user-header-menu open' : 'user-header-menu'}>
        {open && (
          <div className="user-header-popover" role="menu" aria-label="Opciones de usuario">
            <div className="user-header-summary">
              <UserAvatar operador={props.operador} />
              <span><strong>{props.operador.nombre}</strong><small>{props.operador.codigo_operador}</small></span>
            </div>
            <button type="button" role="menuitem" onClick={() => run(props.onEditProfile)}>
              <Edit3 size={18} /> Modificar usuario
            </button>
            <div className="user-header-theme-row" role="menuitem">
              <button type="button" onClick={() => run(props.onAppearance)}>
                <Palette size={18} />
                <span><strong>Apariencia</strong><small>{props.darkTheme ? 'Oscuro Jireh' : 'Tema claro'}</small></span>
              </button>
              <button
                type="button"
                className="theme-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onThemeChange(!props.darkTheme);
                }}
                title={props.darkTheme ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                aria-label={props.darkTheme ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                {props.darkTheme ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            {props.canAdmin && <button type="button" role="menuitem" onClick={() => run(props.onAdmin)}><Settings size={18} /> Configuracion Admin</button>}
            <button type="button" role="menuitem" onClick={() => run(props.onSupport)}><HelpCircle size={18} /> Soporte</button>
            <button className="danger" type="button" role="menuitem" onClick={() => run(props.onLogout)}><LogOut size={18} /> Salir</button>
          </div>
        )}
        <button
          className="user-header-trigger"
          type="button"
          onClick={() => setOpen((current) => !current)}
          title={open ? 'Cerrar opciones' : 'Opciones de usuario'}
          aria-label={open ? 'Cerrar opciones de usuario' : 'Opciones de usuario'}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <UserAvatar operador={props.operador} />
        </button>
      </div>
    </>
  );
}
