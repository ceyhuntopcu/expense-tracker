import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { allocations, incomes } from "@/db/schema";
import {
  allocationBudgetCents,
  formatCents,
  monthlyIncomeCents,
  monthLabel,
  shiftMonth,
} from "@/lib/budget";
import { loadDashboard } from "@/lib/queries";
import {
  BudgetBar,
  categoryColor,
  CategoryRows,
  CompositionStrip,
  DailyRhythm,
  MerchantRows,
  TrendColumns,
} from "@/components/charts";

export const metadata = { title: "Dashboard" };

function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-07-30" → "Thursday, July 30" — no timezone drift. */
function dayHeading(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  });
  const monthName = utc.toLocaleDateString("en-CA", {
    month: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${monthName} ${d}`;
}

/** Italic movement note vs the previous month, or null when meaningless. */
function momNote(current: number, previous: number): string | null {
  if (previous <= 0 || current === previous) return null;
  const delta = current - previous;
  const pct = Math.round((Math.abs(delta) / previous) * 100);
  if (pct < 1) return null;
  return `${delta > 0 ? "up" : "down"} ${pct}% from last month`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : currentMonthString();

  const userId = await requireUserId();
  const [{ current, previous, trend, categories, recent, monthRows }, userAllocations, userIncomes] =
    await Promise.all([
      loadDashboard(userId, month),
      db.query.allocations.findMany({ where: eq(allocations.userId, userId) }),
      db.query.incomes.findMany({ where: eq(incomes.userId, userId) }),
    ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Dominant merchant per category, for the "mostly …" notes.
  const merchantByCategory = new Map<number | null, Map<string, number>>();
  for (const t of monthRows) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const inner = merchantByCategory.get(t.categoryId) ?? new Map();
    inner.set(t.merchant, (inner.get(t.merchant) ?? 0) - t.amountCents);
    merchantByCategory.set(t.categoryId, inner);
  }

  const breakdown = [...current.byCategory.entries()]
    .map(([categoryId, cents]) => {
      const category =
        categoryId !== null ? categoryById.get(categoryId) : undefined;
      const merchants = merchantByCategory.get(categoryId);
      const top = merchants
        ? [...merchants.entries()].sort((a, b) => b[1] - a[1])[0]
        : undefined;
      return {
        name: category?.name ?? "Uncategorized",
        colorToken: category?.colorToken ?? "cat-12",
        cents,
        count: current.categoryCounts.get(categoryId) ?? 0,
        topMerchant:
          top && top[1] / cents > 0.5 ? top[0] : undefined,
        prevCents: previous?.byCategory.get(categoryId) ?? 0,
        href: category
          ? `/categories/${category.id}?month=${month}`
          : `/transactions?month=${month}&category=none`,
      };
    })
    .sort((a, b) => b.cents - a.cents);

  const topMerchants = [...current.byMerchant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([merchant, cents]) => ({
      merchant,
      cents,
      count: current.merchantCounts.get(merchant) ?? 0,
    }));

  // Spending per calendar day.
  const totalDays = daysInMonth(month);
  const dailyCents = Array.from({ length: totalDays }, () => 0);
  for (const t of monthRows) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    dailyCents[Number(t.date.slice(8)) - 1] -= t.amountCents;
  }

  // Budget snapshot (only when a plan exists).
  const monthlyIncome = monthlyIncomeCents(userIncomes);
  const budgetSnapshot = userAllocations
    .map((a) => {
      const category = categoryById.get(a.categoryId);
      if (!category || monthlyIncome === 0) return null;
      const budget = allocationBudgetCents(monthlyIncome, a.percent);
      return {
        name: category.name,
        colorToken: category.colorToken,
        budgetCents: budget,
        actualCents: current.byCategory.get(a.categoryId) ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.budgetCents - a.budgetCents)
    .slice(0, 4);

  const net = current.incomeCents - current.spentCents;
  const keptPct =
    current.incomeCents > 0
      ? Math.round((net / current.incomeCents) * 100)
      : null;
  const hasData = current.spentCents > 0 || current.incomeCents > 0;

  const spentNote = momNote(current.spentCents, previous?.spentCents ?? 0);
  const receivedNote = momNote(current.incomeCents, previous?.incomeCents ?? 0);

  // Group the latest entries by day, journal-style.
  const days: { date: string; entries: typeof recent }[] = [];
  for (const t of recent) {
    const last = days.at(-1);
    if (last && last.date === t.date) last.entries.push(t);
    else days.push({ date: t.date, entries: [t] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight">
          {monthLabel(month)}
        </h1>
        <div className="flex items-baseline gap-5">
          <Link
            href={`/dashboard?month=${shiftMonth(month, -1)}`}
            className="label-caps hover:text-moss"
          >
            ← {monthLabel(shiftMonth(month, -1)).split(" ")[0]}
          </Link>
          {month < currentMonthString() && (
            <Link
              href={`/dashboard?month=${shiftMonth(month, 1)}`}
              className="label-caps hover:text-moss"
            >
              {monthLabel(shiftMonth(month, 1)).split(" ")[0]} →
            </Link>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="rule-t rule-b py-20 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl mb-2">
            Nothing recorded for {monthLabel(month)}.
          </p>
          <p className="italic text-ink-faint">
            <Link href="/import" className="underline hover:text-moss">
              Import a statement
            </Link>{" "}
            to fill the ledger.
          </p>
        </div>
      ) : (
        <>
          {/* Headline figures */}
          <section className="double-rule pt-10 mb-6">
            <div className="grid sm:grid-cols-3 gap-x-8 gap-y-10">
              <div>
                <p className="label-caps mb-3">Spent</p>
                <p className="display-figure text-[3.4rem] leading-none">
                  {formatCents(current.spentCents)}
                </p>
                <p className="mt-3 italic text-ink-faint text-[14px]">
                  {current.spendCount === 1
                    ? "one entry"
                    : `${current.spendCount} entries`}
                  {spentNote && <> · {spentNote}</>}
                </p>
              </div>
              <div>
                <p className="label-caps mb-3">Received</p>
                <p className="display-figure text-[3.4rem] leading-none text-moss">
                  {formatCents(current.incomeCents)}
                </p>
                {receivedNote && (
                  <p className="mt-3 italic text-ink-faint text-[14px]">
                    {receivedNote}
                  </p>
                )}
              </div>
              <div>
                <p className="label-caps mb-3">Kept</p>
                <p
                  className={`display-figure text-[3.4rem] leading-none ${net < 0 ? "text-oxblood" : ""}`}
                >
                  {formatCents(net)}
                </p>
                <p
                  className={`mt-3 italic text-[14px] ${net < 0 ? "text-oxblood" : "text-ink-faint"}`}
                >
                  {net < 0
                    ? "spent more than came in"
                    : keptPct !== null
                      ? `${keptPct}% of what came in`
                      : ""}
                </p>
              </div>
            </div>
          </section>

          {/* Composition strip */}
          {breakdown.length > 0 && (
            <section className="mb-14">
              <CompositionStrip data={breakdown} total={current.spentCents} />
            </section>
          )}

          {/* Daily rhythm */}
          {current.spentCents > 0 && (
            <section className="mb-16">
              <h2 className="label-caps rule-b pb-3 mb-6">
                The rhythm of the month
                <span className="normal-case tracking-normal font-[family-name:var(--font-body)] italic text-ink-faint text-[13px] ml-3">
                  spending by day · dotted line marks a typical spending day
                </span>
              </h2>
              <DailyRhythm
                month={month}
                dailyCents={dailyCents}
                daysInMonth={totalDays}
              />
            </section>
          )}

          <div className="grid lg:grid-cols-[5fr_3fr] gap-x-20 gap-y-16">
            <section>
              <h2 className="label-caps rule-b pb-3 mb-2">Where it went</h2>
              {breakdown.length > 0 ? (
                <CategoryRows data={breakdown} total={current.spentCents} />
              ) : (
                <p className="italic text-ink-faint pt-4">
                  No spending this month.
                </p>
              )}
            </section>

            <div className="space-y-14">
              <section>
                <h2 className="label-caps rule-b pb-3 mb-8">
                  Six-month spending
                </h2>
                <TrendColumns
                  data={trend.map((t) => ({
                    month: t.month,
                    spentCents: t.spentCents,
                  }))}
                  currentMonth={month}
                />
              </section>

              {budgetSnapshot.length > 0 && (
                <section>
                  <div className="flex items-baseline justify-between rule-b pb-3 mb-6">
                    <h2 className="label-caps">Holding the line</h2>
                    <Link href="/budget" className="label-caps hover:text-moss">
                      The plan →
                    </Link>
                  </div>
                  <div className="space-y-5">
                    {budgetSnapshot.map((row) => {
                      const over = row.actualCents > row.budgetCents;
                      return (
                        <div key={row.name}>
                          <div className="flex items-baseline justify-between mb-1.5 text-[14px]">
                            <span>{row.name}</span>
                            <span className="figure text-[13px]">
                              {formatCents(row.actualCents)}
                              <span className="text-ink-faint">
                                {" "}
                                / {formatCents(row.budgetCents)}
                              </span>
                            </span>
                          </div>
                          <BudgetBar
                            budgetCents={row.budgetCents}
                            actualCents={row.actualCents}
                            colorToken={row.colorToken}
                          />
                          {over && (
                            <p className="mt-1 text-[12px] italic text-oxblood">
                              over by{" "}
                              {formatCents(row.actualCents - row.budgetCents)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <h2 className="label-caps rule-b pb-3 mb-6">Top merchants</h2>
                <MerchantRows data={topMerchants} />
              </section>
            </div>
          </div>

          {/* Journal of latest entries, grouped by day */}
          <section className="mt-20">
            <div className="flex items-baseline justify-between rule-b pb-3">
              <h2 className="label-caps">The record</h2>
              <Link
                href={`/transactions?month=${month}`}
                className="label-caps hover:text-moss"
              >
                See all →
              </Link>
            </div>
            {days.map(({ date, entries }) => (
              <div key={date} className="pt-7">
                <p className="font-[family-name:var(--font-display)] italic text-[17px] text-ink-soft mb-1">
                  {dayHeading(date)}
                </p>
                {entries.map((t) => {
                  const category =
                    t.categoryId !== null
                      ? categoryById.get(t.categoryId)
                      : undefined;
                  return (
                    <div
                      key={t.id}
                      className="rule-b py-3.5 flex items-baseline gap-x-4"
                    >
                      <span className="text-[16px] truncate">{t.merchant}</span>
                      <span className="hidden sm:flex items-baseline gap-1.5 text-[13px] text-ink-faint whitespace-nowrap">
                        <span
                          aria-hidden
                          className="self-center size-2 shrink-0"
                          style={{
                            background: categoryColor(
                              category?.colorToken ?? "cat-12",
                            ),
                          }}
                        />
                        {t.isTransfer
                          ? "Transfer"
                          : (category?.name ?? "Uncategorized")}
                      </span>
                      <span
                        className={`figure text-[16px] ml-auto whitespace-nowrap ${
                          t.isTransfer
                            ? "text-ink-faint"
                            : t.amountCents >= 0
                              ? "text-moss"
                              : ""
                        }`}
                      >
                        {formatCents(t.amountCents)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
