import { useEffect, useState } from 'react';
import { CreditCard, Phone, X } from 'lucide-react';
import { eliminarContacto, listarContactos } from '../api/client';
import type { Contacto } from '../types/api';
import { formatearNumeroTarjeta } from '../utils/tarjetas';

type ContactosRecientesProps = {
  clienteId?: string;
  onSelect: (contacto: Contacto) => void;
  onError?: (message: string | null) => void;
};

export function ContactosRecientes({ clienteId, onSelect, onError }: ContactosRecientesProps) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setContactos([]);
      return;
    }

    let active = true;
    setLoading(true);
    listarContactos(clienteId)
      .then((data) => {
        if (active) setContactos(data.filter((contacto) => contacto.activo).slice(0, 12));
      })
      .catch((err) => {
        if (active) onError?.(err instanceof Error ? err.message : 'No se pudieron cargar los contactos');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clienteId, onError]);

  async function borrarContacto(contacto: Contacto) {
    onError?.(null);
    setContactos((current) => current.filter((item) => item.id !== contacto.id));
    try {
      await eliminarContacto(contacto.id);
    } catch (err) {
      setContactos((current) => [contacto, ...current]);
      onError?.(err instanceof Error ? err.message : 'No se pudo eliminar el contacto');
    }
  }

  if (!clienteId || loading || contactos.length === 0) return null;

  return (
    <section className="recent-contacts-block" aria-label="Destinatarios frecuentes">
      <header className="recent-contacts-header">
        <strong>Destinatarios frecuentes</strong>
        <small>Toca uno para reutilizar sus datos</small>
      </header>
      <div className="recent-contacts-rail">
        {contactos.map((contacto) => (
          <article className="recent-contact-card" key={contacto.id}>
            <button className="recent-contact-main" type="button" onClick={() => onSelect(contacto)}>
              <strong>{contacto.nombre}</strong>
              {contacto.numero_tarjeta && (
                <span><CreditCard size={14} /> {formatearNumeroTarjeta(contacto.numero_tarjeta)}</span>
              )}
              {contacto.telefono && (
                <span><Phone size={14} /> {contacto.telefono}</span>
              )}
            </button>
            <button
              className="recent-contact-delete"
              type="button"
              onClick={() => void borrarContacto(contacto)}
              title="Eliminar contacto frecuente"
              aria-label={`Eliminar ${contacto.nombre} de contactos frecuentes`}
            >
              <X size={16} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
