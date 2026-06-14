import type { ChangeEvent, ReactNode } from 'react';
import { ChevronDown, Copy, ExternalLink, FileText, History, Lock, ShieldAlert, Unlock, Upload, X } from 'lucide-react';
import type { ArchivoPedido, PedidoDetalle } from '../../types/api';

export function PedidoDetailHeader({ codigo, servicio, moneda, onClose }: { codigo: string; servicio?: string; moneda?: string; onClose: () => void }) {
  return (
    <header className="order-detail-page-header">
      <div>
        <h2>{codigo}</h2>
        {servicio && <p>{servicio} · {moneda}</p>}
      </div>
      <button type="button" className="ghost-button order-detail-back" onClick={onClose} aria-label="Cerrar detalle" title="Cerrar detalle">
        <X size={18} /> <span>Volver</span>
      </button>
    </header>
  );
}

export function OrderControlHead({
  pedido,
  estado,
  fecha,
  bloqueoPropio,
  bloqueadoPorOtro,
  saving,
  onRelease,
}: {
  pedido: PedidoDetalle;
  estado: string;
  fecha: string;
  bloqueoPropio: boolean;
  bloqueadoPorOtro: boolean;
  saving: boolean;
  onRelease: () => void;
}) {
  return (
    <section className="order-control-head">
      <div className="order-control-meta">
        <span className={`order-state-dot ${pedido.estado}`} />
        <span>{pedido.servicio.replaceAll('_', ' ')} · {pedido.moneda_pago} · {fecha}</span>
      </div>
      <div className="order-control-badges">
        <span className={`status ${pedido.estado}`}>{estado}</span>
        {bloqueoPropio && <span className="lock-chip own"><Lock size={14} /> Tomado por ti</span>}
        {bloqueadoPorOtro && <span className="lock-chip blocked"><ShieldAlert size={14} /> En uso</span>}
      </div>
      {bloqueoPropio && (
        <div className="order-management-actions" aria-label="Acciones de gestion del pedido">
          <button className="release-order-button" type="button" onClick={onRelease} disabled={saving}>
            <Unlock size={15} /> Liberar pedido
          </button>
        </div>
      )}
    </section>
  );
}

export function LiquidationCard({
  pedido,
  tasa,
  monedaEntrega,
  copied,
  onCopy,
}: {
  pedido: PedidoDetalle;
  tasa: number | string;
  monedaEntrega: string;
  copied: (label: string) => boolean;
  onCopy: (value: string, label: string) => void;
}) {
  return (
    <section className="liquidation-card" aria-label="Liquidacion de la orden">
      <div className="liquidation-cell">
        <span>Envia</span>
        <button className={copied('Pagado') ? 'liquidation-copy copied' : 'liquidation-copy'} type="button" onClick={() => onCopy(`${pedido.monto_pago} ${pedido.moneda_pago}`, 'Pagado')}>
          <strong>{pedido.monto_pago}</strong>
          <small>{pedido.moneda_pago}</small>
        </button>
      </div>
      <div className="liquidation-rate"><span>x</span><strong>{tasa}</strong></div>
      <div className="liquidation-cell output">
        <span>Entrega</span>
        <button className={copied('Entrega') ? 'liquidation-copy copied' : 'liquidation-copy'} type="button" onClick={() => onCopy(`${pedido.monto_resultado} ${monedaEntrega}`, 'Entrega')}>
          <strong>{pedido.monto_resultado}</strong>
          <small>{monedaEntrega}</small>
          <Copy size={15} />
        </button>
      </div>
    </section>
  );
}

export function CollapsibleOrderSection({
  open,
  className,
  icon,
  label,
  onToggle,
  children,
}: {
  open: boolean;
  className: string;
  icon: ReactNode;
  label: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`order-detail-section ${className} ${open ? 'open' : 'collapsed'}`}>
      <button className="secondary-action-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{icon}{label}</span>
        <ChevronDown size={17} />
      </button>
      {open && children}
    </section>
  );
}

type EvidenceProps = {
  open: boolean;
  archivos: ArchivoPedido[];
  uploading: boolean;
  disabled: boolean;
  onToggle: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  archivoUrl: (archivo: ArchivoPedido) => string;
  archivoEsImagen: (archivo: ArchivoPedido) => boolean;
  archivoTipoLabel: (tipo: string) => string;
  formatoFecha: (value?: string | null) => string | null;
};

export function OrderEvidenceSection(props: EvidenceProps) {
  return (
    <CollapsibleOrderSection open={props.open} className="order-evidence-section" icon={<Upload size={17} />} label={<>Evidencias · {props.archivos.length}</>} onToggle={props.onToggle}>
      <>
        <label className={props.disabled ? 'upload-button disabled-upload' : 'upload-button'}>
          <Upload size={16} /> {props.uploading ? 'Subiendo...' : 'Subir comprobante'}
          <input type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" onChange={props.onUpload} disabled={props.disabled || props.uploading} />
        </label>
        <div className="archivo-list order-file-list">
          {props.archivos.length === 0 && <div className="order-empty-line">Sin evidencias todavia</div>}
          {props.archivos.map((archivo) => (
            <a key={archivo.id} className="archivo-row file-preview-card" href={props.archivoUrl(archivo)} target="_blank" rel="noreferrer">
              <span className="file-preview-media">
                {props.archivoEsImagen(archivo) ? <img src={props.archivoUrl(archivo)} alt="" loading="lazy" decoding="async" /> : <FileText size={28} />}
              </span>
              <span className="file-preview-copy">
                <strong>{props.archivoTipoLabel(archivo.tipo)}</strong>
                <span>{archivo.nombre_archivo ?? 'Archivo adjunto'}</span>
                {archivo.created_at && <small>{props.formatoFecha(archivo.created_at)}</small>}
              </span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
      </>
    </CollapsibleOrderSection>
  );
}

export function OrderHistorySection({
  open,
  historial,
  onToggle,
  estadoLabel,
  formatoFecha,
}: {
  open: boolean;
  historial: NonNullable<PedidoDetalle['historial']>;
  onToggle: () => void;
  estadoLabel: (value: string) => string;
  formatoFecha: (value?: string | null) => string | null;
}) {
  return (
    <CollapsibleOrderSection open={open} className="order-history-section" icon={<History size={17} />} label={<>Historial · {historial.length}</>} onToggle={onToggle}>
      <div className="order-history-list">
        {historial.length === 0 && <div className="order-empty-line">Sin cambios de estado registrados</div>}
        {historial.map((item) => (
          <div key={item.id} className="order-history-row">
            <span className={`order-state-dot ${item.estado_nuevo}`} />
            <div>
              <strong>{estadoLabel(item.estado_nuevo)}</strong>
              <small>{item.usuario ?? 'Sistema'} · {formatoFecha(item.created_at) ?? 'sin fecha'}</small>
              {item.estado_anterior && <small>Antes: {estadoLabel(item.estado_anterior)}</small>}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleOrderSection>
  );
}
