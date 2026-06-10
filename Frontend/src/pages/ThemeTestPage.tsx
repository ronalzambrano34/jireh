import { useState } from 'react';
import { Calculator, CheckCircle2, Info, Palette, TriangleAlert } from 'lucide-react';
import { FloatingSelect } from '../components/FloatingSelect';
import { PasswordField } from '../components/PasswordField';

const selectOptions = [
  { value: 'transferencia', label: 'Transferencia', description: 'Deposito en tarjeta' },
  { value: 'efectivo', label: 'Efectivo', description: 'Entrega a domicilio' },
  { value: 'saldo', label: 'Saldo movil', description: 'Recarga Cubacel' },
];

function ComponentSet({ calculator = false }: { calculator?: boolean }) {
  const [password, setPassword] = useState('jireh-demo');
  const [service, setService] = useState('transferencia');
  const prefix = calculator ? 'calculator-demo' : 'base-demo';

  return (
    <div className={calculator ? 'theme-component-set calculator-set' : 'theme-component-set base-set'}>
      <article className="theme-test-card">
        <header>
          <span className="theme-test-card-icon">{calculator ? <Calculator size={19} /> : <Palette size={19} />}</span>
          <div>
            <h3>Tarjeta de contenido</h3>
            <p>Superficie, borde, sombra y jerarquia de texto.</p>
          </div>
        </header>
        <div className="theme-test-metric">
          <span>Monto estimado</span>
          <strong>48.250 <small>CUP</small></strong>
        </div>
      </article>

      <article className="theme-test-card">
        <h3>Campos de formulario</h3>
        <label htmlFor={`${prefix}-text`}>
          Nombre del cliente
          <input id={`${prefix}-text`} defaultValue="Maria Rodriguez" />
        </label>
        <label htmlFor={`${prefix}-amount`}>
          Monto
          <div className={calculator ? 'theme-calculator-input' : undefined}>
            <input id={`${prefix}-amount`} type="number" defaultValue="200" />
            {calculator && <strong>BRL</strong>}
          </div>
        </label>
        <label htmlFor={`${prefix}-password`}>
          Contraseña
          <PasswordField id={`${prefix}-password`} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label htmlFor={`${prefix}-select`}>
          Selector nativo
          <select id={`${prefix}-select`} defaultValue="transferencia">
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </label>
        <label>
          Selector flotante
          <FloatingSelect value={service} options={selectOptions} onChange={setService} align="left" />
        </label>
        <label htmlFor={`${prefix}-notes`}>
          Observaciones
          <textarea id={`${prefix}-notes`} rows={3} placeholder="Escribe una nota para la operacion" />
        </label>
        <label htmlFor={`${prefix}-disabled`}>
          Campo deshabilitado
          <input id={`${prefix}-disabled`} value="No editable" disabled readOnly />
        </label>
      </article>

      <article className="theme-test-card">
        <h3>Acciones y estados</h3>
        <div className="theme-test-actions">
          <button className="primary-button" type="button">Accion principal</button>
          <button className="ghost-button" type="button">Secundaria</button>
          <button className="primary-button" type="button" disabled>Deshabilitada</button>
        </div>
        <div className="notice success"><CheckCircle2 size={17} /> Operacion guardada correctamente.</div>
        <div className="notice warning"><TriangleAlert size={17} /> Revisa la tasa antes de continuar.</div>
        <div className="notice error"><Info size={17} /> No se pudo completar la prueba.</div>
      </article>

      <article className="theme-test-card">
        <h3>Datos tabulares</h3>
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
  );
}

export function ThemeTestPage() {
  return (
    <section className="theme-test-page">
      <div className="theme-test-intro">
        <div>
          <span className="theme-test-kicker">Laboratorio visual</span>
          <h2>Comparador de tema</h2>
          <p>Cambia el tema desde el menu de usuario y compara los mismos estados en ambas familias de componentes.</p>
        </div>
        <span className="theme-test-theme-hint"><Palette size={17} /> Usa claro y oscuro</span>
      </div>

      <div className="theme-test-columns">
        <section className="theme-test-column">
          <header className="theme-test-column-header">
            <span>Columna 1</span>
            <h2>Componentes base</h2>
            <p>Controles y tarjetas usados en formularios, login y administracion.</p>
          </header>
          <ComponentSet />
        </section>

        <section className="theme-test-column calculator-column">
          <header className="theme-test-column-header">
            <span>Columna 2</span>
            <h2>Estilo calculadora</h2>
            <p>La referencia visual de los componentes nuevos que ya responden bien al tema.</p>
          </header>
          <ComponentSet calculator />
        </section>
      </div>
    </section>
  );
}
