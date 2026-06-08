import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'jireh.pwa.install-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED_KEY)) return undefined;

    function handlePrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    const event = promptEvent;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setPromptEvent(null);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setPromptEvent(null);
  }

  return (
    <aside className="pwa-install-prompt" aria-label="Instalar aplicacion">
      <div>
        <strong>Instalar Jireh</strong>
        <span>Abre mas rapido y conserva la interfaz sin conexion.</span>
      </div>
      <button className="primary-button" type="button" onClick={() => void install()}>
        <Download size={17} /> Instalar
      </button>
      <button className="icon-button" type="button" onClick={dismiss} aria-label="Cerrar">
        <X size={17} />
      </button>
    </aside>
  );
}
