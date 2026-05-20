import { FormEvent, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { login, setToken } from '../api/client';
import type { Operador } from '../types/api';

export function LoginPage({ onLogin }: { onLogin: (operador: Operador) => void }) {
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
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
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-mark"><LockKeyhole size={24} /></div>
        <h1>Jireh Operaciones</h1>
        <label>
          Telefono
          <input value={telefono} onChange={(event) => setTelefono(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Contrasena
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
