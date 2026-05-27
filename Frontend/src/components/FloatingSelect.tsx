import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export type FloatingSelectOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

type FloatingSelectPlacement = 'down' | 'up';

type FloatingSelectProps = {
  value: string;
  options: FloatingSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
};

function findFloatingBoundary(node: HTMLElement | null) {
  let parent = node?.parentElement ?? null;

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
    if (/(auto|scroll|hidden|clip)/.test(overflow)) return parent;
    parent = parent.parentElement;
  }

  return null;
}

export function FloatingSelect({ value, options, onChange, disabled = false, placeholder = 'Seleccionar', ariaLabel, className = '', buttonClassName = '', menuClassName = '', align = 'right' }: FloatingSelectProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<FloatingSelectPlacement>('down');
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const enabledOptions = options.filter((option) => !option.disabled);
  const label = selected?.label ?? placeholder;

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) return;

    const rootRect = rootRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.scrollHeight;
    const boundary = findFloatingBoundary(rootRef.current);
    const boundaryRect = boundary?.getBoundingClientRect();
    const topLimit = Math.max(12, boundaryRect?.top ?? 12);
    const bottomLimit = Math.min(window.innerHeight - 12, boundaryRect?.bottom ?? window.innerHeight - 12);
    const gap = 8;
    const spaceBelow = Math.max(0, bottomLimit - rootRect.bottom - gap);
    const spaceAbove = Math.max(0, rootRect.top - topLimit - gap);
    const nextPlacement: FloatingSelectPlacement = spaceBelow < menuHeight && spaceAbove > spaceBelow ? 'up' : 'down';
    const available = nextPlacement === 'up' ? spaceAbove : spaceBelow;
    const nextMaxHeight = Math.max(1, Math.floor(Math.min(menuHeight, available || menuHeight)));

    setPlacement(nextPlacement);
    setMenuMaxHeight(nextMaxHeight);
  }, [open, options.length]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <span ref={rootRef} className={["floating-select", open ? 'open' : '', placement === 'up' ? 'drop-up' : '', className].filter(Boolean).join(' ')}>
      {open && <button className="floating-select-backdrop" type="button" aria-label="Cerrar selector" onClick={() => setOpen(false)} />}
      <button
        className={["floating-select-button", buttonClassName].filter(Boolean).join(' ')}
        type="button"
        disabled={disabled || enabledOptions.length === 0}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
      >
        {selected?.icon && <span className="floating-select-icon" aria-hidden="true">{selected.icon}</span>}
        <span className="floating-select-current">{label}</span>
        <ChevronDown className="floating-select-chevron" size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          className={["floating-select-menu", align === 'left' ? 'align-left' : '', menuClassName].filter(Boolean).join(' ')}
          role="menu"
          style={menuMaxHeight ? { maxHeight: menuMaxHeight } : undefined}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={option.value === value ? 'active' : ''}
              disabled={option.disabled}
              onClick={() => selectValue(option.value)}
            >
              {option.icon && <span className="floating-select-option-icon" aria-hidden="true">{option.icon}</span>}
              <span className="floating-select-option-copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
