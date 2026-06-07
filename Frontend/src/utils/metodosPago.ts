import bbvaLogo from '../assets/icono_bancos/bbva.webp';
import brouLogo from '../assets/icono_bancos/brow.webp';
import itauLogo from '../assets/icono_bancos/itau.webp';
import mdLogo from '../assets/icono_bancos/MiDinero.webp';
import ocaLogo from '../assets/icono_bancos/oca.webp';
import pixLogo from '../assets/icono_bancos/pix.webp';
import prexLogo from '../assets/icono_bancos/prex.webp';
import santanderLogo from '../assets/icono_bancos/santander.webp';
import scotiaLogo from '../assets/icono_bancos/soctiabank.webp';
import { apiAssetUrl } from '../api/client';
import type { MetodoPago } from '../types/api';
import { Banknote, type LucideIcon } from 'lucide-react';

type MetodoVisual = { src?: string; Icon?: LucideIcon; initials: string };

function normalizar(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function metodoPagoVisual(metodo?: Pick<MetodoPago, 'nombre' | 'moneda' | 'imagen_url'> | null): MetodoVisual {
  const nombre = normalizar(metodo?.nombre ?? '');
  const initials = (metodo?.nombre ?? metodo?.moneda ?? 'MP')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'MP';

  if (metodo?.imagen_url) return { src: apiAssetUrl(metodo.imagen_url), initials };

  if (nombre.includes('efectivo') || nombre.includes('dinero') || nombre.includes('cash')) {
    return { Icon: Banknote, initials: 'EF' };
  }
  if (nombre.includes('pix')) return { src: pixLogo, initials: 'PX' };
  if (nombre.includes('itau')) return { src: itauLogo, initials: 'IT' };
  if (nombre.includes('santander')) return { src: santanderLogo, initials: 'ST' };
  if (nombre.includes('bbva')) return { src: bbvaLogo, initials: 'BV' };
  if (nombre.includes('prex')) return { src: prexLogo, initials: 'PX' };
  if (nombre.includes('oca')) return { src: ocaLogo, initials: 'OC' };
  if (nombre.includes('scotia') || nombre.includes('scotiabank')) return { src: scotiaLogo, initials: 'SB' };
  if (nombre.includes('brou') || nombre.includes('brow')) return { src: brouLogo, initials: 'BR' };
  if (nombre.includes('mercado') || nombre === 'md') return { src: mdLogo, initials: 'MD' };

  return { initials };
}
