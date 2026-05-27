import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { login, setToken } from '../api/client';
import type { Operador } from '../types/api';
import logoJireh from '../assets/brand/logo-jireh.jpeg';
import { PhoneInput } from '../components/PhoneInput';
import { PageLoader } from '../components/PageLoader';
import { PasswordField } from '../components/PasswordField';

export function LoginPage({ onLogin }: { onLogin: (operador: Operador) => void }) {
  const [telefono, setTelefono] = useState(import.meta.env.VITE_TEST_LOGIN_TELEFONO ?? '');
  const [password, setPassword] = useState(import.meta.env.VITE_TEST_LOGIN_PASSWORD ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await login(telefono, password);
      setToken(response.access_token);
      onLogin(response.operador);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <img className="login-bg-logo" src={logoJireh} alt="" aria-hidden="true" />
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src={logoJireh} alt="El Jireh" />
          <span className="login-mark"><LockKeyhole size={22} /></span>
        </div>
        <div className="login-title">
          <h1>Jireh Operaciones</h1>
          <p>Panel interno de pedidos y tasas</p>
        </div>
        <label>
          Telefono
          <PhoneInput value={telefono} onChange={setTelefono} defaultCode="+55" autoComplete="username" showPaste={false} />
        </label>
        <label>
          Contraseña
          <PasswordField value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
      {loading && <PageLoader label="Iniciando sesion" />}
    </main>
  );
}
