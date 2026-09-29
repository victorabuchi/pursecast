"use client";

import { useState } from "react";
import styles from "./app.module.css";
import I from "./Icon";
import {
  CURRENCY_CODES,
  convert,
  type Rates,
} from "../../lib/money/currencies";
import { currencySymbol, exact, parseAmount } from "../../lib/money/format";

const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
})();

// A price with its currency: the symbol is a dropdown, so a Render plan can
// be entered in dollars while everything else stays in the account currency.
// Posts `${name}` (the amount) and `${name}Currency` (empty for the account
// currency). Controlled when value/onChange are given.
export default function PriceInput({
  name,
  account,
  rates,
  currency: givenCurrency,
  onCurrency,
  value,
  onChange,
  defaultValue = "",
  placeholder = "0",
  label,
  autoFocus,
}: {
  name: string;
  account: string;
  rates: Rates;
  currency?: string;
  onCurrency?: (c: string) => void;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const [ownCurrency, setOwnCurrency] = useState(givenCurrency || account);
  const [ownValue, setOwnValue] = useState(defaultValue);
  const cur = onCurrency ? givenCurrency || account : ownCurrency;
  const text = onChange ? (value ?? "") : ownValue;
  const sym = currencySymbol(cur);
  const foreign = cur !== account;
  const cents = foreign && text ? parseAmount(text) : null;
  const inAccount = cents ? convert(cents, cur, account, rates) : null;

  return (
    <span
      className={`${styles.money} ${styles.priceBox}`}
      data-hint={inAccount !== null}
    >
      <label
        className={styles.curPick}
        data-foreign={foreign}
        title="Currency this is billed in"
      >
        <span aria-hidden="true">{sym}</span>
        <I d="chevron" size={11} stroke={2.6} />
        <select
          value={cur}
          aria-label={`${label ?? "Price"} currency`}
          onChange={(e) => {
            if (onCurrency) onCurrency(e.target.value);
            else setOwnCurrency(e.target.value);
          }}
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {currencySymbol(c)} · {names?.of(c) ?? c}
            </option>
          ))}
        </select>
      </label>
      <input
        className={styles.input}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={label}
        style={{
          paddingLeft: 34 + sym.length * 9,
        }}
        onChange={(e) => {
          if (onChange) onChange(e.target.value);
          else setOwnValue(e.target.value);
        }}
      />
      {inAccount !== null && (
        <small
          className={styles.priceHint}
          title={`About ${exact(inAccount, account)} at today's rate`}
        >
          ≈ {exact(inAccount, account)}
        </small>
      )}
      <input
        type="hidden"
        name={`${name}Currency`}
        value={foreign ? cur : ""}
      />
    </span>
  );
}
