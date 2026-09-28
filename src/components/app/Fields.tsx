import styles from './app.module.css';
import { currencySymbol } from '../../lib/money/format';

// A money input with the currency symbol inside. Values are whole or decimal
// units; the server parses them into cents.
export function MoneyInput({ name, currency, value, placeholder = '0', required, autoFocus, label }: { name: string; currency: string; value?: number | null; placeholder?: string; required?: boolean; autoFocus?: boolean; label?: string }) {
  const initial = value === null || value === undefined ? '' : String(Math.abs(value) % 100 ? (Math.abs(value) / 100).toFixed(2) : Math.abs(value) / 100);
  return (
    <span className={styles.money}>
      <span>{currencySymbol(currency)}</span>
      <input className={styles.input} name={name} inputMode="decimal" autoComplete="off" defaultValue={initial} placeholder={placeholder} required={required} autoFocus={autoFocus} aria-label={label} />
    </span>
  );
}

// − / + as two radio buttons.
export function SignToggle({ name, value, minus = '−', plus = '+', label }: { name: string; value: '-' | '+'; minus?: string; plus?: string; label: string }) {
  return (
    <span className={styles.sign} role="radiogroup" aria-label={label}>
      <label>
        <input type="radio" name={name} value="-" defaultChecked={value === '-'} />
        {minus}
      </label>
      <label>
        <input type="radio" name={name} value="+" defaultChecked={value === '+'} />
        {plus}
      </label>
    </span>
  );
}
