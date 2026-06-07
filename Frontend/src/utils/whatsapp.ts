export type VentanaWhatsApp = Window | null;

function esDispositivoMovil() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function urlWhatsAppParaDispositivo(url: string) {
  if (!esDispositivoMovil()) return url;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const esWaMe = hostname === 'wa.me' || hostname.endsWith('.wa.me');
    const esWhatsAppWeb = (
      hostname === 'api.whatsapp.com'
      || hostname === 'web.whatsapp.com'
    ) && parsed.pathname.replace(/\/+$/, '') === '/send';

    if (!esWaMe && !esWhatsAppWeb) return url;

    const phone = esWaMe
      ? parsed.pathname.replace(/\D/g, '')
      : (parsed.searchParams.get('phone') ?? '').replace(/\D/g, '');
    const params = new URLSearchParams();
    if (phone) params.set('phone', phone);

    const text = parsed.searchParams.get('text');
    if (text) params.set('text', text);

    const query = params.toString();
    return `whatsapp://send${query ? `?${query}` : ''}`;
  } catch {
    return url;
  }
}

function urlsWhatsAppValidas(urls: Array<string | null | undefined>) {
  return urls.filter((url): url is string => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

export function reservarVentanasWhatsApp(cantidad = 1): VentanaWhatsApp[] {
  if (typeof window === 'undefined') return [];

  return Array.from({ length: cantidad }, () => {
    const popup = window.open('', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.title = 'Abriendo WhatsApp';
      popup.document.body.textContent = 'Preparando mensaje de WhatsApp...';
    }
    return popup;
  });
}

export function cerrarVentanasWhatsApp(ventanas: VentanaWhatsApp[]) {
  ventanas.forEach((ventana) => {
    if (ventana && !ventana.closed) ventana.close();
  });
}

export function abrirWhatsAppUrlsReservadas(
  ventanas: VentanaWhatsApp[],
  ...urls: Array<string | null | undefined>
) {
  const validas = urlsWhatsAppValidas(urls);

  validas.forEach((url, index) => {
    const destino = urlWhatsAppParaDispositivo(url);
    const reservada = ventanas[index];
    if (reservada && !reservada.closed) {
      reservada.location.href = destino;
      return;
    }

    window.setTimeout(() => {
      window.open(destino, '_blank', 'noopener,noreferrer');
    }, index * 180);
  });

  ventanas.slice(validas.length).forEach((ventana) => {
    if (ventana && !ventana.closed) ventana.close();
  });
}

export function abrirWhatsAppUrls(...urls: Array<string | null | undefined>) {
  urlsWhatsAppValidas(urls).forEach((url, index) => {
    const destino = urlWhatsAppParaDispositivo(url);
    window.setTimeout(() => {
      window.open(destino, '_blank', 'noopener,noreferrer');
    }, index * 180);
  });
}

export function abrirWhatsAppUrl(url?: string | null) {
  if (!url || typeof window === 'undefined') return;

  const destino = urlWhatsAppParaDispositivo(url);
  if (destino.startsWith('whatsapp://')) {
    window.location.href = destino;
    return;
  }

  window.open(destino, '_blank', 'noopener,noreferrer');
}
