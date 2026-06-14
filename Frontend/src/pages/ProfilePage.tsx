import type { FormEvent } from 'react';
import { ChevronDown, Copy, Edit3, HelpCircle, KeyRound, LogOut, Palette, Percent, ShieldCheck } from 'lucide-react';
import { apiAssetUrl } from '../api/client';
import { PasswordField } from '../components/PasswordField';
import { UiSwitch } from '../components/UiSwitch';
import type { Operador } from '../types/api';
import { abrirWhatsAppUrl } from '../utils/whatsapp';
import './profile/ProfilePage.css';

export type ProfileSection = 'editar' | 'permisos' | 'password' | 'ayuda' | null;
export type ProfilePassword = { actual: string; nueva: string; confirmar: string };

function iniciales(operador: Operador) {
  return operador.nombre.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Avatar({ operador }: { operador: Operador }) {
  if (operador.foto_url) return <img className="profile-avatar initials avatar-photo" src={apiAssetUrl(operador.foto_url)} alt="" />;
  return <span className="profile-avatar initials">{iniciales(operador)}</span>;
}

function WhatsAppIcon() {
  return <span className="whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M16.1 4.2C9.7 4.2 4.5 9.4 4.5 15.8c0 2.1.6 4.2 1.7 6L4.4 28l6.4-1.7c1.6.9 3.4 1.3 5.3 1.3 6.4 0 11.6-5.2 11.6-11.6S22.5 4.2 16.1 4.2Zm0 21.4c-1.7 0-3.3-.4-4.7-1.2l-.3-.2-3.8 1 1-3.7-.2-.4c-1-1.5-1.5-3.3-1.5-5.2 0-5.3 4.3-9.6 9.6-9.6s9.6 4.3 9.6 9.6-4.4 9.7-9.7 9.7Zm5.3-7.2c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.2-.2-.4-.3-.7-.4Z" /></svg></span>;
}

export function ProfilePage(props: {
  operador: Operador;
  section: ProfileSection;
  nombre: string;
  password: ProfilePassword;
  theme: 'light' | 'dark-sidebar';
  saving: boolean;
  photoSaving: boolean;
  onSectionChange: (section: Exclude<ProfileSection, null>) => void;
  onNombreChange: (value: string) => void;
  onPasswordChange: (value: ProfilePassword) => void;
  onThemeChange: (theme: 'light' | 'dark-sidebar') => void;
  onPhoto: (file: File) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSavePassword: (event: FormEvent<HTMLFormElement>) => void;
  onCopyCode: () => void;
  onLogout: () => void;
}) {
  const option = (section: Exclude<ProfileSection, null>) => props.section === section ? 'profile-option active' : 'profile-option';

  return (
    <section className="profile-page">
      <div className="profile-hero-card">
        <div className="profile-hero-main">
          <div className="profile-avatar-wrap">
            <Avatar operador={props.operador} />
            <label className="profile-photo-upload" title="Cambiar foto">
              {props.photoSaving ? 'Subiendo...' : 'Cambiar foto'}
              <input type="file" accept="image/*" disabled={props.photoSaving} onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onPhoto(file); event.currentTarget.value = ''; }} />
            </label>
          </div>
          <div><h2>{props.operador.nombre}</h2><p>{props.operador.telefono}</p></div>
        </div>
        <div className="profile-hero-meta">
          <span>Codigo: <strong>{props.operador.codigo_operador}</strong></span>
          <span>Rol: <strong>{props.operador.rol}</strong></span>
          <button className="icon-button" onClick={props.onCopyCode} title="Copiar codigo" aria-label="Copiar codigo"><Copy size={18} /></button>
        </div>
      </div>

      <div className="profile-section">
        <h3>Mi cuenta</h3>
        <button className={option('editar')} type="button" onClick={() => props.onSectionChange('editar')} aria-expanded={props.section === 'editar'}><Edit3 size={22} /><span>Modificar perfil</span><ChevronDown className={props.section === 'editar' ? 'chevron-open' : ''} size={18} /></button>
        {props.section === 'editar' && <form className="profile-inline-panel profile-form" onSubmit={props.onSaveProfile}>
          <label><span>Nombre visible</span><input value={props.nombre} onChange={(event) => props.onNombreChange(event.target.value)} autoComplete="name" /></label>
          <label><span>Telefono de acceso</span><input value={props.operador.telefono ?? ''} disabled /></label>
          <small>El telefono se mantiene fijo para evitar cambios accidentales en el acceso.</small>
          <button className="primary-action" type="submit" disabled={props.saving}>{props.saving ? 'Guardando...' : 'Guardar datos'}</button>
        </form>}

        <button className={option('permisos')} type="button" onClick={() => props.onSectionChange('permisos')} aria-expanded={props.section === 'permisos'}><Percent size={22} /><span>Mis permisos y rol</span><ChevronDown className={props.section === 'permisos' ? 'chevron-open' : ''} size={18} /></button>
        {props.section === 'permisos' && <div className="profile-inline-panel"><div className="profile-role-pill"><ShieldCheck size={18} /> {props.operador.rol}</div><div className="profile-permission-list">{props.operador.permisos.length ? props.operador.permisos.map((permiso) => <span key={permiso}>{permiso}</span>) : <span>Sin permisos especiales</span>}</div></div>}

        <div className="profile-appearance-row">
          <span className="profile-appearance-icon" aria-hidden="true"><Palette size={22} /></span>
          <div className="profile-appearance-copy">
            <div className="profile-appearance-title"><strong>Apariencia</strong><label className="theme-switch"><UiSwitch checked={props.theme !== 'light'} onChange={(checked) => props.onThemeChange(checked ? 'dark-sidebar' : 'light')} ariaLabel="Activar tema oscuro" /><span>Oscuro</span></label></div>
            <small>{props.theme === 'light' ? 'Tema claro' : 'Oscuro Jireh predeterminado'}</small>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3>Seguridad</h3>
        <button className={option('password')} type="button" onClick={() => props.onSectionChange('password')} aria-expanded={props.section === 'password'}><KeyRound size={22} /><span>Cambiar contraseña</span><ChevronDown className={props.section === 'password' ? 'chevron-open' : ''} size={18} /></button>
        {props.section === 'password' && <form className="profile-inline-panel profile-form" onSubmit={props.onSavePassword}>
          <label><span>Contraseña actual</span><PasswordField value={props.password.actual} onChange={(event) => props.onPasswordChange({ ...props.password, actual: event.target.value })} autoComplete="current-password" /></label>
          <label><span>Nueva contraseña</span><PasswordField value={props.password.nueva} onChange={(event) => props.onPasswordChange({ ...props.password, nueva: event.target.value })} autoComplete="new-password" /></label>
          <label><span>Confirmar nueva</span><PasswordField value={props.password.confirmar} onChange={(event) => props.onPasswordChange({ ...props.password, confirmar: event.target.value })} autoComplete="new-password" /></label>
          <button className="primary-action" type="submit" disabled={props.saving}>{props.saving ? 'Actualizando...' : 'Cambiar contraseña'}</button>
        </form>}
      </div>

      <div className="profile-section">
        <h3>Soporte</h3>
        <button className={option('ayuda')} type="button" onClick={() => props.onSectionChange('ayuda')} aria-expanded={props.section === 'ayuda'}><HelpCircle size={22} /><span>Ayuda para operar</span><ChevronDown className={props.section === 'ayuda' ? 'chevron-open' : ''} size={18} /></button>
        {props.section === 'ayuda' && <div className="profile-support-options"><div className="profile-support-panel">
          <a className="support-whatsapp-link support-whatsapp-link-br" href="https://wa.me/554891233191?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/554891233191?text=Ayuda'); }} target="_blank" rel="noreferrer"><WhatsAppIcon /><span><strong>Brasil</strong><small>+55 48 9123-3191</small></span></a>
          <a className="support-whatsapp-link support-whatsapp-link-uy" href="https://wa.me/59894207862?text=Ayuda" onClick={(event) => { event.preventDefault(); abrirWhatsAppUrl('https://wa.me/59894207862?text=Ayuda'); }} target="_blank" rel="noreferrer"><WhatsAppIcon /><span><strong>Uruguay</strong><small>+598 94 207 862</small></span></a>
        </div></div>}
        <button className="profile-option danger profile-logout-option" type="button" onClick={props.onLogout}><LogOut size={22} /><span>Salir</span></button>
      </div>
    </section>
  );
}
