import type { Income } from "@/db/schema";

/** Pay-period → average months multiplier. */
const MONTHLY_FACTOR: Record<Income["frequency"], number> = {
  monthly: 1,
  semimonthly: 2,
  biweekly: 26 / 12,
  weekly: 52 / 12,
};

/** Sum of all income sources normalized to a monthly figure, in cents. */
export function monthlyIncomeCents(incomes: Income[]): number {
  return Math.round(
    incomes.reduce(
      (sum, income) =>
        sum + income.amountCents * MONTHLY_FACTOR[income.frequency],
      0,
    ),
  );
}

/** percent ("12.50") of monthly income, in cents. */
export function allocationBudgetCents(
  monthlyIncome: number,
  percent: string | number,
): number {
  return Math.round((monthlyIncome * Number(percent)) / 100);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-CA");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/** "2026-08" for a YYYY-MM-DD date string. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[m - 1]} ${y}`;
}

/**
 * Inclusive start / exclusive end date bounds for a month. Never build a
 * "-31" literal — short months make Postgres reject it as an invalid date.
 */
export function monthRange(month: string): { start: string; endExclusive: string } {
  return { start: `${month}-01`, endExclusive: `${shiftMonth(month, 1)}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
