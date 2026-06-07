import { useState, type ChangeEventHandler } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordFieldProps = {
  value: string;
  id?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
};

export function PasswordField({ value, id, onChange, autoComplete, placeholder, required }: PasswordFieldProps) {
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        value={value}
        onChange={onChange}
        type={mostrarPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setMostrarPassword((value) => !value)}
        title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
