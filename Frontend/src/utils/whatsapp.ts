export function abrirWhatsAppUrls(...urls: Array<string | null | undefined>) {
  urls.filter(Boolean).forEach((url, index) => {
    window.setTimeout(() => {
      window.open(url as string, '_blank', 'noopener,noreferrer');
    }, index * 180);
  });
}
