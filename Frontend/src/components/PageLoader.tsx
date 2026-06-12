import logoJireh from '../assets/brand/logo-jireh.jpeg';

type PageLoaderProps = {
  label?: string;
  inline?: boolean;
};

export function PageLoader({ label = 'Cargando', inline = false }: PageLoaderProps) {
  return (
    <div className={inline ? 'logo-bounce-loader inline-loader' : 'logo-bounce-loader'} aria-label={label} role="status">
      <img src={logoJireh} alt="" />
      <span>{label}</span>
    </div>
  );
}
