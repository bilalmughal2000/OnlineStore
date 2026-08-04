'use client';

/**
 * Pakistani mobile number input.
 *
 * The country code is fixed UI furniture rather than something to type, so the
 * only thing a buyer can get wrong is the 10-digit national number — and a live
 * counter tells them exactly how far along they are. This matters at checkout:
 * the phone is how the courier reaches them for a COD delivery, and it was
 * previously the single most common reason an order was rejected.
 *
 * Stored value is the 10 national digits ("3001234567"). Use toE164PK() to
 * produce what the API expects.
 */

/** Digits of a PK mobile after the country code: 3 followed by 9 more. */
export const PK_NATIONAL_LENGTH = 10;

/**
 * Strips whatever the user typed or pasted down to the national digits.
 * Handles `+92 300 1234567`, `0300-1234567`, `92 3001234567` and `3001234567`.
 */
export function normalisePKPhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, PK_NATIONAL_LENGTH);
}

export const isValidPKMobile = (national: string) => /^3\d{9}$/.test(national);

/** "3001234567" → "+923001234567" (the format the API accepts). */
export const toE164PK = (national: string) => `+92${national}`;

export function PhoneField({
  value,
  onChange,
  error,
  id = 'phone',
}: {
  /** The 10 national digits, without +92 or a leading 0. */
  value: string;
  onChange: (national: string) => void;
  error?: string;
  id?: string;
}) {
  const filled = value.length;
  const complete = filled === PK_NATIONAL_LENGTH;
  // Only complain once they've typed enough to mean it — flagging "must start
  // with 3" on the first keystroke is just nagging.
  const wrongPrefix = filled > 0 && !value.startsWith('3');
  const showError = error || (complete && !isValidPKMobile(value)) || wrongPrefix;

  return (
    <div data-field="newAddress.phone">
      <label className="label" htmlFor={id}>
        Phone
      </label>

      <div
        className={`flex items-stretch overflow-hidden rounded-md border bg-white ${
          showError ? 'border-sale' : 'border-ink/15 focus-within:border-accent'
        }`}
      >
        <span className="flex select-none items-center gap-1.5 border-r border-ink/10 bg-black/[0.03] px-3 text-sm text-ink/70">
          <span aria-hidden>🇵🇰</span> +92
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          placeholder="3001234567"
          value={value}
          // No maxLength: it would truncate the RAW text before normalisation,
          // so pasting "03001234567" or "+92 300 1234567" would silently lose
          // digits off the end. normalisePKPhone() caps the result instead.
          onChange={(e) => onChange(normalisePKPhone(e.target.value))}
          aria-invalid={Boolean(showError)}
          aria-describedby={`${id}-hint`}
        />
        <span
          className={`flex select-none items-center pr-3 text-xs tabular-nums ${
            complete && isValidPKMobile(value) ? 'text-green-600' : 'text-ink/40'
          }`}
        >
          {filled}/{PK_NATIONAL_LENGTH}
        </span>
      </div>

      <p
        id={`${id}-hint`}
        className={`mt-1 text-xs ${showError ? 'text-sale' : 'text-ink/55'}`}
      >
        {error
          ? error
          : wrongPrefix
            ? 'Mobile numbers start with 3 — enter it without the leading 0.'
            : complete && !isValidPKMobile(value)
              ? 'That doesn’t look like a Pakistani mobile number.'
              : `Enter your ${PK_NATIONAL_LENGTH}-digit mobile number, e.g. 0300 1234567 → 3001234567`}
      </p>
    </div>
  );
}
