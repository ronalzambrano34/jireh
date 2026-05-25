import { useEffect, useState } from 'react';
import { CreditCard, Phone, X } from 'lucide-react';
import { eliminarContacto, listarContactos } from '../api/client';
import type { Contacto } from '../types/api';

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

  if (!clienteId) {
    return (
      <div className="recent-contacts-empty">
        Busca el cliente por WhatsApp para ver sus destinatarios recientes.
      </div>
    );
  }

  if (loading) {
    return <div className="recent-contacts-empty">Cargando contactos recientes...</div>;
  }

  if (contactos.length === 0) {
    return <div className="recent-contacts-empty">Sin contactos guardados para este cliente.</div>;
  }

  return (
    <div className="recent-contacts-rail" aria-label="Contactos recientes">
      {contactos.map((contacto) => (
        <article className="recent-contact-card" key={contacto.id}>
          <button className="recent-contact-main" type="button" onClick={() => onSelect(contacto)}>
            <strong>{contacto.nombre}</strong>
            {contacto.numero_tarjeta && (
              <span><CreditCard size={14} /> {contacto.numero_tarjeta}</span>
            )}
            {contacto.telefono && (
              <span><Phone size={14} /> {contacto.telefono}</span>
            )}
          </button>
          <button
            className="recent-contact-delete"
            type="button"
            onClick={() => void borrarContacto(contacto)}
            title="Eliminar contacto del historial"
            aria-label={`Eliminar ${contacto.nombre} del historial`}
          >
            <X size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}
