import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ClipboardList, Send, Trash2, VolumeX } from 'lucide-react';
import '../styles/notification-bell.css';

export type AppNotificationKind = 'nuevo_pedido' | 'pedido_transferido' | 'pedido_atrasado';
export type NotificationSoundPreferences = Record<AppNotificationKind, boolean>;

export const notificationKindLabels: Record<AppNotificationKind, string> = {
  nuevo_pedido: 'Nuevo pedido',
  pedido_transferido: 'Pedido transferido',
  pedido_atrasado: 'Pedido atrasado',
};

export const defaultNotificationSoundPreferences: NotificationSoundPreferences = {
  nuevo_pedido: true,
  pedido_transferido: true,
  pedido_atrasado: true,
};

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
  soundPreferences: NotificationSoundPreferences;
  onSelect: (id: string) => void;
  onMuteKind: (kind: AppNotificationKind) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
};

function notificationIcon(kind: AppNotificationKind) {
  if (kind === 'pedido_atrasado') return <Bell size={17} />;
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
  soundPreferences,
  onSelect,
  onMuteKind,
  onMarkRead,
  onDelete,
  onMarkAllRead,
  onClear,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
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
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setOpen(false);
    onSelect(id);
  }

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function startLongPress(kind: AppNotificationKind) {
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onMuteKind(kind);
    }, 650);
  }

  useEffect(() => clearLongPress, []);

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
            {notifications.map((notification) => {
              const muted = soundPreferences[notification.kind] === false;
              return (
                <div
                  key={notification.id}
                  className={['notification-bell-item', notification.kind, notification.read ? '' : 'unread', muted ? 'sound-muted' : ''].filter(Boolean).join(' ')}
                  role="menuitem"
                  onPointerDown={() => startLongPress(notification.kind)}
                  onPointerUp={clearLongPress}
                  onPointerCancel={clearLongPress}
                  onPointerLeave={clearLongPress}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    clearLongPress();
                    onMuteKind(notification.kind);
                  }}
                  title={`Abrir ${notificationKindLabels[notification.kind]}`}
                >
                  <button className="notification-bell-open" type="button" onClick={() => select(notification.id)}>
                    <span className="notification-bell-icon" aria-hidden="true">{notificationIcon(notification.kind)}</span>
                  </button>
                  <button className="notification-bell-copy" type="button" onClick={() => select(notification.id)}>
                    <strong>{notification.title}</strong>
                    <small>{notification.body}</small>
                  </button>
                  <span className="notification-bell-meta">
                    <time>{timeLabel(notification.createdAt)}</time>
                    {muted && <VolumeX size={13} aria-label="Sonido silenciado" />}
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        clearLongPress();
                        onMarkRead(notification.id);
                      }}
                      disabled={notification.read}
                      title="Marcar leida"
                      aria-label="Marcar leida"
                    >
                      <CheckCheck size={14} />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        clearLongPress();
                        onDelete(notification.id);
                      }}
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
