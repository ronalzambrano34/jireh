import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ClipboardList, Send, Trash2 } from 'lucide-react';
import '../styles/notification-bell.css';

export type AppNotificationKind = 'nuevo_pedido' | 'pedido_transferido';

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  codigo: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
};

type NotificationBellProps = {
  notifications: AppNotification[];
  unreadCount: number;
  onSelect: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
};

function notificationIcon(kind: AppNotificationKind) {
  return kind === 'pedido_transferido' ? <Send size={17} /> : <ClipboardList size={17} />;
}

function timeLabel(value: number) {
  const diff = Date.now() - value;
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return new Date(value).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
}

export function NotificationBell({
  notifications,
  unreadCount,
  onSelect,
  onMarkAllRead,
  onClear,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  useEffect(() => {
    if (!open) return undefined;

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function select(id: string) {
    setOpen(false);
    onSelect(id);
  }

  return (
    <div ref={rootRef} className={open ? 'notification-bell open' : 'notification-bell'}>
      <button
        className="notification-bell-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Notificaciones"
        aria-label={`Notificaciones${unreadCount ? `, ${unreadCount} sin leer` : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-bell-badge">{badgeLabel}</span>}
      </button>

      {open && (
        <div className="notification-bell-popover" role="menu" aria-label="Notificaciones">
          <header className="notification-bell-header">
            <span>
              <strong>Notificaciones</strong>
              <small>{unreadCount ? `${unreadCount} sin leer` : 'Todo al dia'}</small>
            </span>
            <div>
              <button type="button" onClick={onMarkAllRead} disabled={!unreadCount} title="Marcar leidas" aria-label="Marcar leidas">
                <CheckCheck size={16} />
              </button>
              <button type="button" onClick={onClear} disabled={!notifications.length} title="Limpiar" aria-label="Limpiar">
                <Trash2 size={16} />
              </button>
            </div>
          </header>

          <div className="notification-bell-list">
            {notifications.length === 0 && (
              <p className="notification-bell-empty">Sin notificaciones</p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                className={notification.read ? 'notification-bell-item' : 'notification-bell-item unread'}
                type="button"
                role="menuitem"
                onClick={() => select(notification.id)}
              >
                <span className="notification-bell-icon" aria-hidden="true">{notificationIcon(notification.kind)}</span>
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                </span>
                <time>{timeLabel(notification.createdAt)}</time>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
