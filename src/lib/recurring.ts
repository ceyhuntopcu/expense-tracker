import { monthOf } from "@/lib/budget";

export type RecurringCharge = {
  merchant: string;
  categoryId: number | null;
  /** Median charge, in positive cents. */
  typicalCents: number;
  annualizedCents: number;
  monthsSeen: number;
  monthsInWindow: number;
  lastDate: string;
  /** True when the amount barely moves — a subscription rather than a habit. */
  steady: boolean;
};

type Txn = {
  date: string;
  merchant: string;
  amountCents: number;
  categoryId: number | null;
  isTransfer: boolean;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Find the standing orders: merchants charging in most months of the window
 * with a steady amount. `txns` should span the window (e.g. the last 6
 * months); transfers and income are ignored.
 *
 * A merchant qualifies when it appears in ≥3 distinct months (or every month
 * of a shorter history ≥2), charging once or twice a month, and its typical
 * amounts stay within ±30% of the median — rent, subscriptions, gym fees;
 * not groceries.
 */
export function detectRecurring(
  txns: Txn[],
  monthsInWindow: number,
): RecurringCharge[] {
  const byMerchant = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const results: RecurringCharge[] = [];
  for (const [merchant, list] of byMerchant) {
    const months = new Set(list.map((t) => monthOf(t.date)));
    const monthsSeen = months.size;
    const required = Math.min(3, Math.max(2, monthsInWindow));
    if (monthsSeen < required) continue;
    // Once or twice a month, not constant small purchases.
    if (list.length / monthsSeen > 2.5) continue;

    // Per-month totals must be steady.
    const perMonth = new Map<string, number>();
    for (const t of list) {
      const m = monthOf(t.date);
      perMonth.set(m, (perMonth.get(m) ?? 0) - t.amountCents);
    }
    const totals = [...perMonth.values()];
    const typical = median(totals);
    if (typical <= 0) continue;
    const steady = totals.every(
      (v) => v >= typical * 0.7 && v <= typical * 1.3,
    );
    if (!steady) continue;

    const latest = list.reduce((a, b) => (a.date > b.date ? a : b));
    results.push({
      merchant,
      categoryId: latest.categoryId,
      typicalCents: typical,
      annualizedCents: typical * 12,
      monthsSeen,
      monthsInWindow,
      lastDate: latest.date,
      steady,
    });
  }

  return results.sort((a, b) => b.typicalCents - a.typicalCents);
}
