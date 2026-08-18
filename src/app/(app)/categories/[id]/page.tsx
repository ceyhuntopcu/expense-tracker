import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { formatCents, monthLabel, monthOf, monthRange, shiftMonth } from "@/lib/budget";
import { transactionsBetween, userAccountIds } from "@/lib/queries";
import { categoryColor, MerchantRows, TrendColumns } from "@/components/charts";

export const metadata = { title: "Category" };

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const month =
    query.month && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : new Date().toISOString().slice(0, 7);

  const userId = await requireUserId();
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.id, Number(id)), eq(categories.userId, userId)),
  });
  if (!category) notFound();

  const accountIds = await userAccountIds(userId);
  const windowStart = `${shiftMonth(month, -5)}-01`;
  const rows = (
    await transactionsBetween(accountIds, windowStart, monthRange(month).endExclusive)
  ).filter((t) => t.categoryId === category.id && !t.isTransfer);

  // Six-month trend for this category alone.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i));
  const trend = months.map((m) => ({
    month: m,
    spentCents: rows
      .filter((t) => monthOf(t.date) === m && t.amountCents < 0)
      .reduce((s, t) => s - t.amountCents, 0),
  }));

  const monthEntries = rows.filter((t) => monthOf(t.date) === month);
  const spent = trend[trend.length - 1].spentCents;
  const prev = trend[trend.length - 2]?.spentCents ?? 0;
  const sixMonthTotal = trend.reduce((s, t) => s + t.spentCents, 0);

  const merchantTotals = new Map<string, { cents: number; count: number }>();
  for (const t of monthEntries) {
    if (t.amountCents >= 0) continue;
    const entry = merchantTotals.get(t.merchant) ?? { cents: 0, count: 0 };
    entry.cents -= t.amountCents;
    entry.count += 1;
    merchantTotals.set(t.merchant, entry);
  }
  const merchants = [...merchantTotals.entries()]
    .map(([merchant, e]) => ({ merchant, ...e }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 8);

  const delta = prev > 0 ? spent - prev : null;

  return (
    <div className="max-w-4xl">
      <p className="mb-6">
        <Link
          href={`/dashboard?month=${month}`}
          className="label-caps hover:text-moss"
        >
          ← {monthLabel(month)}
        </Link>
      </p>

      <div className="flex items-baseline gap-4 mb-3">
        <span
          aria-hidden
          className="self-center size-4 shrink-0"
          style={{ background: categoryColor(category.colorToken) }}
        />
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight">
          {category.name}
        </h1>
      </div>
      <p className="italic text-ink-soft mb-12">
        filed under {category.group} · {monthLabel(month)}
      </p>

      <section className="double-rule pt-8 mb-14 grid sm:grid-cols-3 gap-x-8 gap-y-8">
        <div>
          <p className="label-caps mb-3">This month</p>
          <p className="display-figure text-[2.8rem] leading-none">
            {formatCents(spent)}
          </p>
          {delta !== null && Math.abs(delta) >= 100 && (
            <p
              className={`mt-3 italic text-[14px] ${delta > 0 ? "text-oxblood" : "text-moss"}`}
            >
              {delta > 0 ? "▲" : "▼"} {formatCents(Math.abs(delta))} vs last
              month
            </p>
          )}
        </div>
        <div>
          <p className="label-caps mb-3">Entries</p>
          <p className="display-figure text-[2.8rem] leading-none">
            {monthEntries.length}
          </p>
        </div>
        <div>
          <p className="label-caps mb-3">Last six months</p>
          <p className="display-figure text-[2.8rem] leading-none">
            {formatCents(sixMonthTotal)}
          </p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-x-20 gap-y-14 mb-16">
        <section>
          <h2 className="label-caps rule-b pb-3 mb-8">Six-month course</h2>
          <TrendColumns data={trend} currentMonth={month} />
        </section>
        <section>
          <h2 className="label-caps rule-b pb-3 mb-6">
            Who got it this month
          </h2>
          {merchants.length > 0 ? (
            <MerchantRows data={merchants} />
          ) : (
            <p className="italic text-ink-faint">
              Nothing here in {monthLabel(month)}.
            </p>
          )}
        </section>
      </div>

      <section>
        <h2 className="label-caps rule-b pb-3">Every entry</h2>
        {monthEntries.length === 0 ? (
          <p className="italic text-ink-faint pt-6">
            No entries in {monthLabel(month)}.
          </p>
        ) : (
          monthEntries.map((t) => (
            <div
              key={t.id}
              className="rule-b py-3.5 flex items-baseline gap-x-4"
            >
              <span className="figure text-ink-faint whitespace-nowrap text-[14px]">
                {t.date}
              </span>
              <span className="text-[16px] truncate" title={t.description}>
                {t.merchant}
              </span>
              <span
                className={`figure text-[16px] ml-auto whitespace-nowrap ${t.amountCents >= 0 ? "text-moss" : ""}`}
              >
                {formatCents(t.amountCents)}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
