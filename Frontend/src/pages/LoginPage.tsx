import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole, WifiOff } from 'lucide-react';
import { login, setToken } from '../api/client';
import type { Operador } from '../types/api';
import logoJireh from '../assets/brand/logo-jireh.jpeg';
import { PhoneInput } from '../components/PhoneInput';
import { PasswordField } from '../components/PasswordField';
import { DismissibleNotice } from '../components/DismissibleNotice';
import { PageLoader } from '../components/PageLoader';
import bannerJireh from '../assets/brand/banner-jireh.webp';

const DEV_LOGIN_TELEFONO = import.meta.env.VITE_TEST_LOGIN_TELEFONO || (import.meta.env.DEV ? '+1234567890' : '');
const DEV_LOGIN_PASSWORD = import.meta.env.VITE_TEST_LOGIN_PASSWORD || (import.meta.env.DEV ? 'admin' : '');
const LOGIN_PHONE_KEY = 'jireh.login.telefono';

const LOGIN_PROGRESS_MESSAGES = [
  'Comprobando la conexion...',
  'Validando las credenciales...',
  'Protegiendo la comunicacion...',
  'Esperando respuesta del servidor...',
  'Preparando el espacio de trabajo...',
  'Verificando permisos de la cuenta...',
  'Confirmando la sesion...',
];

function loginProgressLabel(seconds: number) {
  if (seconds >= 30) return 'La respuesta esta demorando. Comprueba tu conexion; seguimos intentando...';
  return LOGIN_PROGRESS_MESSAGES[Math.floor(seconds / 3) % LOGIN_PROGRESS_MESSAGES.length];
}

export function LoginPage({ onLogin }: { onLogin: (operador: Operador) => void }) {
  const [telefono, setTelefono] = useState(() => DEV_LOGIN_TELEFONO || localStorage.getItem(LOGIN_PHONE_KEY) || '');
  const [password, setPassword] = useState(DEV_LOGIN_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const submittingRef = useRef(false);
  const progressLabel = useMemo(() => loginProgressLabel(elapsedSeconds), [elapsedSeconds]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!telefono.trim() || !password) {
      setError('Escribe telefono y contraseña para entrar.');
      return;
    }

    if (!online) {
      setError('No hay conexion en este momento. Cuando vuelva la senal, intenta entrar otra vez.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await login(telefono, password);
      localStorage.setItem(LOGIN_PHONE_KEY, telefono);
      setToken(response.access_token);
      onLogin(response.operador);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <img className="login-bg-logo" src={bannerJireh} alt="" aria-hidden="true" />
      <form className="login-panel theme-test-card theme-form-card" onSubmit={handleSubmit}>
        <header className="login-header">
          <div className="login-brand">
            <img src={logoJireh} alt="El Jireh" />
            <div className="login-title">
              <span className="theme-test-kicker">Acceso seguro</span>
              <h1>Jireh Operaciones</h1>
              <p>Gestion de pedidos y tasas</p>
            </div>
          </div>
          <span className="login-security-badge"><LockKeyhole size={16} /> Operaciones</span>
        </header>
        {!online && (
          <div className="login-network-status offline">
            <WifiOff size={16} /> Sin conexion. Conservamos tus datos en pantalla.
          </div>
        )}
        <label className="login-control" htmlFor="login-telefono">
          <span>Telefono</span>
          <PhoneInput inputId="login-telefono" value={telefono} onChange={setTelefono} defaultCode="+55" autoComplete="username" showPaste={false} />
        </label>
        <label className="login-control" htmlFor="login-password">
          <span>Contraseña</span>
          <PasswordField id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error && <DismissibleNotice className="notice error" role="alert">{error}</DismissibleNotice>}
        {loading && (
          <div className="login-progress" role="status" aria-live="polite">
            <PageLoader inline label="Iniciando sesion" />
            <div className="login-progress-text">{progressLabel}</div>
          </div>
        )}
        <button type="submit" className="primary-button" disabled={loading || !online} aria-busy={loading ? 'true' : 'false'}>{loading ? `Entrando... ${elapsedSeconds}s` : 'Entrar'}</button>
      </form>
    </main>
  );
}
