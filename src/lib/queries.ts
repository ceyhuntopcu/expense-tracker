import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { monthOf, monthRange, shiftMonth } from "@/lib/budget";

export async function userAccountIds(userId: number): Promise<number[]> {
  const rows = await db.query.accounts.findMany({
    where: eq(accounts.userId, userId),
    columns: { id: true },
  });
  return rows.map((r) => r.id);
}

/** All transactions in [startDate, endDateExclusive), newest first. */
export async function transactionsBetween(
  accountIds: number[],
  startDate: string,
  endDateExclusive: string,
) {
  if (accountIds.length === 0) return [];
  return db.query.transactions.findMany({
    where: and(
      inArray(transactions.accountId, accountIds),
      gte(transactions.date, startDate),
      lt(transactions.date, endDateExclusive),
    ),
    orderBy: [desc(transactions.date), desc(transactions.id)],
  });
}

/** All non-transfer transactions for a month window (inclusive). */
export async function monthTransactions(
  accountIds: number[],
  fromMonth: string,
  toMonth: string,
) {
  if (accountIds.length === 0) return [];
  return db.query.transactions.findMany({
    where: and(
      inArray(transactions.accountId, accountIds),
      gte(transactions.date, monthRange(fromMonth).start),
      lt(transactions.date, monthRange(toMonth).endExclusive),
    ),
    orderBy: [desc(transactions.date), desc(transactions.id)],
  });
}

export type MonthSummary = {
  month: string;
  spentCents: number; // positive number: money out, transfers excluded
  incomeCents: number; // positive number: money in, transfers excluded
  spendCount: number;
  byCategory: Map<number | null, number>; // categoryId → spent cents
  byMerchant: Map<string, number>;
  categoryCounts: Map<number | null, number>;
  merchantCounts: Map<string, number>;
};

export function summarizeMonth(
  rows: Awaited<ReturnType<typeof monthTransactions>>,
  month: string,
): MonthSummary {
  const summary: MonthSummary = {
    month,
    spentCents: 0,
    incomeCents: 0,
    spendCount: 0,
    byCategory: new Map(),
    byMerchant: new Map(),
    categoryCounts: new Map(),
    merchantCounts: new Map(),
  };
  for (const t of rows) {
    if (monthOf(t.date) !== month || t.isTransfer) continue;
    if (t.amountCents < 0) {
      const spent = -t.amountCents;
      summary.spentCents += spent;
      summary.spendCount += 1;
      summary.byCategory.set(
        t.categoryId,
        (summary.byCategory.get(t.categoryId) ?? 0) + spent,
      );
      summary.categoryCounts.set(
        t.categoryId,
        (summary.categoryCounts.get(t.categoryId) ?? 0) + 1,
      );
      summary.byMerchant.set(
        t.merchant,
        (summary.byMerchant.get(t.merchant) ?? 0) + spent,
      );
      summary.merchantCounts.set(
        t.merchant,
        (summary.merchantCounts.get(t.merchant) ?? 0) + 1,
      );
    } else {
      summary.incomeCents += t.amountCents;
    }
  }
  return summary;
}

export async function loadDashboard(userId: number, month: string) {
  const accountIds = await userAccountIds(userId);
  const trendStart = shiftMonth(month, -5);
  const rows = await monthTransactions(accountIds, trendStart, month);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i));
  const trend = months.map((m) => summarizeMonth(rows, m));
  const current = trend[trend.length - 1];

  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
    orderBy: (c, { asc }) => asc(c.sortOrder),
  });

  const monthRows = rows.filter((t) => monthOf(t.date) === month);
  const recent = monthRows.slice(0, 14);

  return {
    current,
    previous: trend[trend.length - 2],
    trend,
    categories: userCategories,
    recent,
    monthRows,
    accountIds,
  };
}
