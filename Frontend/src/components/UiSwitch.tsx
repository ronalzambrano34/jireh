type UiSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function UiSwitch({ checked, onChange, ariaLabel, disabled = false }: UiSwitchProps) {
  return (
    <input
      className="ui-switch"
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
