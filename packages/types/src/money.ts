// Money helpers. Amounts are handled as rupees (number) at the boundary but
// compared/summed in integer minor units (paise) to avoid float drift.

export function toMinor(amountRupees: number): number {
  return Math.round(amountRupees * 100);
}

export function fromMinor(paise: number): number {
  return paise / 100;
}

export function sumMinor(amounts: number[]): number {
  return amounts.reduce((acc, a) => acc + toMinor(a), 0);
}

/** True when the installment amounts sum exactly to the total (paise-precise). */
export function amountsSumTo(total: number, parts: number[]): boolean {
  return sumMinor(parts) === toMinor(total);
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatInr(amountRupees: number): string {
  return inrFormatter.format(amountRupees);
}
