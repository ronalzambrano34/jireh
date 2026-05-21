import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { login, setToken } from '../api/client';
import type { Operador } from '../types/api';

export function LoginPage({ onLogin }: { onLogin: (operador: Operador) => void }) {
  const [telefono, setTelefono] = useState(import.meta.env.VITE_TEST_LOGIN_TELEFONO ?? '');
  const [password, setPassword] = useState(import.meta.env.VITE_TEST_LOGIN_PASSWORD ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

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
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-mark"><LockKeyhole size={24} /></div>
        <h1>Jireh Operaciones</h1>
        <label>
          Telefono
          <input value={telefono} onChange={(event) => setTelefono(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Contrasena
          <div className="password-field">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setMostrarPassword((value) => !value)}
              title={mostrarPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
              aria-label={mostrarPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
