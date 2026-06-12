import { FloatingSelect } from './FloatingSelect';
import { banderaMoneda, nombreMoneda } from '../utils/monedas';

type CurrencySelectProps = {
  value: string;
  currencies: string[];
  onChange: (value: string) => void;
  ariaLabel?: string;
};

export function CurrencySelect({
  value,
  currencies,
  onChange,
  ariaLabel = 'Moneda de recepcion',
}: CurrencySelectProps) {
  return (
    <FloatingSelect
      className="currency-picker-wrap currency-reception-select"
      buttonClassName="currency-picker currency-picker-button"
      menuClassName="currency-picker-menu currency-reception-menu"
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      options={currencies.map((currency) => ({
        value: currency,
        label: `${currency} (${nombreMoneda(currency)})`,
        description: `Pago en ${nombreMoneda(currency).toLowerCase()}`,
        icon: <span className="currency-picker-flag" aria-hidden="true">{banderaMoneda(currency)}</span>,
      }))}
    />
  );
}
