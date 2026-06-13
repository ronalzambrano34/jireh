import { useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CreditCard,
  Home,
  Info,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { CardNumberInput } from '../components/CardNumberInput';
import { CurrencySelect } from '../components/CurrencySelect';
import { FloatingSelect } from '../components/FloatingSelect';
import { PasswordField } from '../components/PasswordField';
import { PhoneInput } from '../components/PhoneInput';
import logoJireh from '../assets/brand/logo-jireh.jpeg';

const palette = [
  { name: 'Fondo', token: 'Canvas', value: '#08111F', className: 'canvas' },
  { name: 'Superficie', token: 'Surface', value: '#0F1B2D', className: 'surface' },
  { name: 'Elevada', token: 'Raised', value: '#16243A', className: 'raised' },
  { name: 'Verde Jireh', token: 'Primary', value: '#2FA66F', className: 'primary' },
  { name: 'Azul', token: 'Info', value: '#2F6FDB', className: 'info' },
  { name: 'Dorado', token: 'Warning', value: '#E3B341', className: 'warning' },
  { name: 'Rojo', token: 'Danger', value: '#DC5A63', className: 'danger' },
  { name: 'Texto', token: 'Text', value: '#F4F7FB', className: 'text' },
];

const services = [
  { value: 'transferencia', label: 'Transferencia', description: 'Deposito en tarjeta', icon: <WalletCards size={18} /> },
  { value: 'efectivo', label: 'Efectivo', description: 'Entrega fisica', icon: <Banknote size={18} /> },
  { value: 'saldo', label: 'Saldo movil', description: 'Recarga Cubacel', icon: <CreditCard size={18} /> },
];

export function ThemeTestPage() {
  const [service, setService] = useState('transferencia');
  const [currency, setCurrency] = useState('BRL');
  const [phone, setPhone] = useState('+5548991233191');
  const [password, setPassword] = useState('jireh-demo');
  const [card, setCard] = useState('9205123456789012');

  return (
    <section className="theme-test-page">
      <header className="theme-test-intro">
        <div>
          <span className="theme-test-kicker">Sistema visual Jireh</span>
          <h2>Oscuro profesional, claro y operativo</h2>
          <p>Una sola jerarquia de superficies y cuatro colores con funcion definida.</p>
        </div>
        <span className="theme-test-theme-hint"><ShieldCheck size={18} /> Fuente de verdad UI</span>
      </header>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>01</span><h2>Paleta</h2></div>
          <p>Verde para accion y confirmacion, azul para informacion, dorado para atencion y rojo para error.</p>
        </div>
        <div className="theme-palette-grid">
          {palette.map((color) => (
            <article className="theme-swatch" key={color.token}>
              <span className={`theme-swatch-color ${color.className}`} />
              <strong>{color.name}</strong>
              <small>{color.token} · {color.value}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>02</span><h2>Tipografia y acciones</h2></div>
          <p>El peso crea jerarquia; el color no reemplaza la estructura.</p>
        </div>
        <div className="theme-lab-grid two">
          <article className="theme-test-card theme-type-card">
            <span className="theme-test-kicker">Operacion diaria</span>
            <h1>48.250 CUP</h1>
            <h2>Nuevo pedido</h2>
            <h3>Pago de la operacion</h3>
            <p>Texto secundario para orientar sin competir con el dato principal.</p>
            <small>Informacion auxiliar y metadatos</small>
          </article>
          <article className="theme-test-card">
            <h3>Botones</h3>
            <div className="theme-test-actions">
              <button className="primary-button" type="button">Accion principal</button>
              <button className="ghost-button" type="button">Secundaria</button>
              <button className="danger-button" type="button">Cancelar</button>
              <button className="primary-button" type="button" disabled>Deshabilitada</button>
            </div>
            <div className="theme-icon-actions">
              <button className="icon-button" type="button" aria-label="Buscar"><Search size={18} /></button>
              <button className="icon-button" type="button" aria-label="Calendario"><CalendarRange size={18} /></button>
              <button className="icon-button" type="button" aria-label="Usuario"><UserRound size={18} /></button>
            </div>
          </article>
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>03</span><h2>Formularios</h2></div>
          <p>Todos los controles comparten altura, radio, fondo, borde y foco.</p>
        </div>
        <div className="theme-lab-grid two">
          <article className="theme-test-card theme-form-card">
            <label>Nombre del cliente<input defaultValue="Maria Rodriguez" /></label>
            <label>Telefono<PhoneInput value={phone} onChange={setPhone} defaultCode="+55" showPaste={false} /></label>
            <label>Contraseña<PasswordField value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Numero de tarjeta<CardNumberInput value={card} onChange={setCard} /></label>
          </article>
          <article className="theme-test-card theme-form-card">
            <label>Servicio<FloatingSelect value={service} options={services} onChange={setService} align="left" /></label>
            <label>Moneda de recepcion<CurrencySelect value={currency} currencies={['BRL', 'UYU', 'USD', 'EUR']} onChange={setCurrency} /></label>
            <label>Observaciones<textarea rows={3} placeholder="Escribe una nota operativa" /></label>
            <label>Campo deshabilitado<input value="No editable" disabled readOnly /></label>
          </article>
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>04</span><h2>Estados y datos</h2></div>
          <p>El color aparece cuando aporta significado operativo.</p>
        </div>
        <div className="theme-lab-grid two">
          <article className="theme-test-card">
            <div className="notice success"><CheckCircle2 size={18} /> Operacion guardada correctamente.</div>
            <div className="notice warning"><AlertTriangle size={18} /> Revisa la tasa antes de continuar.</div>
            <div className="notice error"><Info size={18} /> No se pudo completar la operacion.</div>
            <div className="theme-status-row">
              <span className="theme-status active">Completado</span>
              <span className="theme-status pending">Pendiente</span>
              <span className="theme-status neutral"><Clock3 size={13} /> En proceso</span>
            </div>
          </article>
          <article className="theme-test-card">
            <div className="theme-test-metric"><span>Pedidos del mes</span><strong>128</strong></div>
            <div className="theme-test-table-wrap">
              <table className="theme-test-table">
                <thead><tr><th>Servicio</th><th>Estado</th><th>Monto</th></tr></thead>
                <tbody>
                  <tr><td>Transferencia</td><td><span className="theme-status active">Activa</span></td><td>200 BRL</td></tr>
                  <tr><td>Efectivo</td><td><span className="theme-status pending">Pendiente</span></td><td>150 USD</td></tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>05</span><h2>Superficies</h2></div>
          <p>El contraste se construye por niveles, no con negro contra negro.</p>
        </div>
        <div className="theme-surface-demo">
          <article><Palette size={20} /><span><strong>Canvas</strong><small>Fondo general</small></span></article>
          <article><WalletCards size={20} /><span><strong>Surface</strong><small>Paneles y secciones</small></span></article>
          <article><Banknote size={20} /><span><strong>Raised</strong><small>Tarjetas y controles</small></span></article>
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>06</span><h2>Acentos y seleccion</h2></div>
          <p>El borde izquierdo identifica superficies importantes y conserva el contexto de navegacion.</p>
        </div>
        <div className="theme-lab-grid two">
          <article className="theme-test-card ui-accent-card">
            <span className="theme-test-kicker">Superficie principal</span>
            <h3>Card con acento</h3>
            <p>Patron oficial para formularios, paneles operativos, reportes y detalles.</p>
          </article>
          <nav className="theme-nav-demo" aria-label="Ejemplo de navegacion">
            <button className="ui-nav-item active" type="button"><Home size={18} /><span>Inicio</span></button>
            <button className="ui-nav-item" type="button"><ClipboardList size={18} /><span>Pedidos</span></button>
            <button className="ui-nav-item" type="button"><Settings size={18} /><span>Configuracion</span></button>
          </nav>
        </div>
      </section>

      <section className="theme-lab-section">
        <div className="theme-lab-heading">
          <div><span>07</span><h2>Efectos visuales</h2></div>
          <p>Glass, transparencia y carga forman parte del sistema visual y deben reutilizarse sin cajas opacas.</p>
        </div>
        <div className="theme-effects-grid">
          <article className="theme-test-card ui-glass-surface">
            <span className="theme-test-kicker">Glass surface</span>
            <h3>Profundidad sin perder contexto</h3>
            <p>Superficie translucida para acceso, modales y paneles destacados sobre fondos con imagen.</p>
          </article>
          <article className="theme-loader-preview" aria-label="Ejemplo del indicador de carga">
            <div className="ui-loader-mark">
              <img src={logoJireh} alt="" />
              <span>Cargando informacion</span>
            </div>
            <small>Loading transparente, amplio y sin contenedor rectangular.</small>
          </article>
        </div>
      </section>
    </section>
  );
}
