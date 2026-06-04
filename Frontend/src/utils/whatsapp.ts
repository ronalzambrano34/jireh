export function abrirWhatsAppUrls(...urls: Array<string | null | undefined>) {
  urls.filter((url): url is string => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'chat.whatsapp.com') return false;
      if ((hostname === 'wa.me' || hostname.endsWith('.wa.me')) && parsed.pathname.replaceAll('/', '') === '') return false;
      return true;
    } catch {
      return false;
    }
  }).forEach((url, index) => {
    window.setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    }, index * 180);
  });
}
