import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type FloatingSelectOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

type FloatingSelectPlacement = 'down' | 'up';

type FloatingMenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

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

export function FloatingSelect({ value, options, onChange, disabled = false, placeholder = 'Seleccionar', ariaLabel, className = '', buttonClassName = '', menuClassName = '', align = 'right' }: FloatingSelectProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<FloatingSelectPlacement>('down');
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const enabledOptions = options.filter((option) => !option.disabled);
  const label = selected?.label ?? placeholder;

  const updateMenuPosition = useCallback(() => {
    if (!rootRef.current || !menuRef.current) return;

    const rootRect = rootRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.scrollHeight;
    const viewportPadding = 12;
    const topLimit = viewportPadding;
    const bottomLimit = window.innerHeight - viewportPadding;
    const gap = 8;
    const spaceBelow = Math.max(0, bottomLimit - rootRect.bottom - gap);
    const spaceAbove = Math.max(0, rootRect.top - topLimit - gap);
    const nextPlacement: FloatingSelectPlacement = spaceBelow < menuHeight && spaceAbove > spaceBelow ? 'up' : 'down';
    const available = nextPlacement === 'up' ? spaceAbove : spaceBelow;
    const nextMaxHeight = Math.max(44, Math.floor(Math.min(menuHeight, available || menuHeight)));
    const viewportWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const nextWidth = Math.min(
      Math.max(rootRect.width, 230),
      280,
      viewportWidth,
    );
    const naturalLeft = align === 'left'
      ? rootRect.left
      : rootRect.right - nextWidth;
    const nextLeft = Math.min(
      Math.max(viewportPadding, naturalLeft),
      Math.max(viewportPadding, window.innerWidth - viewportPadding - nextWidth),
    );
    const visibleHeight = Math.min(menuHeight, nextMaxHeight);
    const nextTop = nextPlacement === 'up'
      ? rootRect.top - gap - visibleHeight
      : rootRect.bottom + gap;

    setPlacement(nextPlacement);
    setMenuPosition({
      left: Math.round(nextLeft),
      top: Math.round(nextTop),
      width: Math.round(nextWidth),
      maxHeight: nextMaxHeight,
    });
  }, [align]);

  useEffect(() => {
    if (!open) return undefined;

    function closeFromOutside(target: EventTarget | null) {
      if (!(target instanceof Node)) return;
      if (target instanceof HTMLElement && target.classList.contains('floating-select-backdrop')) {
        setOpen(false);
        return;
      }
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      closeFromOutside(event.target);
    }

    function handleMouseDown(event: MouseEvent) {
      closeFromOutside(event.target);
    }

    function handleTouchStart(event: TouchEvent) {
      closeFromOutside(event.target);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    function handleResize() {
      setOpen(false);
    }

    let animationFrame = 0;
    function handleScroll() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateMenuPosition);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('touchstart', handleTouchStart, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, options.length, updateMenuPosition]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
        visibility: 'visible',
      }
    : { visibility: 'hidden' };

  return (
    <span ref={rootRef} className={["floating-select", open ? 'open' : '', placement === 'up' ? 'drop-up' : '', className].filter(Boolean).join(' ')}>
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
      {open && createPortal(
        <>
          <button className="floating-select-backdrop floating-select-portal-backdrop" type="button" aria-label="Cerrar selector" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={id}
            className={["floating-select-menu", "floating-select-portal-menu", placement === 'up' ? 'drop-up' : '', align === 'left' ? 'align-left' : '', menuClassName].filter(Boolean).join(' ')}
            role="menu"
            style={menuStyle}
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
        </>,
        document.body,
      )}
    </span>
  );
}
