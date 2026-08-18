import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { formatCents, monthRange, shiftMonth } from "@/lib/budget";
import { transactionsBetween, userAccountIds } from "@/lib/queries";
import { categoryColor } from "@/components/charts";

export const metadata = { title: "Merchants" };

const RANGES = [
  { key: "month", label: "This month" },
  { key: "3m", label: "Last 3 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function rangeBounds(range: RangeKey): { start: string; end: string } {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const end = monthRange(thisMonth).endExclusive;
  if (range === "month") return { start: `${thisMonth}-01`, end };
  if (range === "3m") return { start: `${shiftMonth(thisMonth, -2)}-01`, end };
  if (range === "12m") return { start: `${shiftMonth(thisMonth, -11)}-01`, end };
  return { start: "1900-01-01", end };
}

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === params.range)
    ? (params.range as RangeKey)
    : "3m";

  const userId = await requireUserId();
  const [accountIds, userCategories] = await Promise.all([
    userAccountIds(userId),
    db.query.categories.findMany({ where: eq(categories.userId, userId) }),
  ]);
  const categoryById = new Map(userCategories.map((c) => [c.id, c]));

  const { start, end } = rangeBounds(range);
  const rows = await transactionsBetween(accountIds, start, end);

  type Entry = {
    cents: number;
    count: number;
    categoryTotals: Map<number | null, number>;
    lastDate: string;
  };
  const byMerchant = new Map<string, Entry>();
  let totalSpent = 0;
  for (const t of rows) {
    if (t.isTransfer || t.amountCents >= 0) continue;
    const spent = -t.amountCents;
    totalSpent += spent;
    const entry = byMerchant.get(t.merchant) ?? {
      cents: 0,
      count: 0,
      categoryTotals: new Map(),
      lastDate: t.date,
    };
    entry.cents += spent;
    entry.count += 1;
    entry.categoryTotals.set(
      t.categoryId,
      (entry.categoryTotals.get(t.categoryId) ?? 0) + spent,
    );
    if (t.date > entry.lastDate) entry.lastDate = t.date;
    byMerchant.set(t.merchant, entry);
  }

  const ranked = [...byMerchant.entries()]
    .map(([merchant, e]) => {
      const domCategoryId = [...e.categoryTotals.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      const category =
        domCategoryId !== null && domCategoryId !== undefined
          ? categoryById.get(domCategoryId)
          : undefined;
      return { merchant, ...e, category };
    })
    .sort((a, b) => b.cents - a.cents);

  const top3Share =
    totalSpent > 0
      ? Math.round(
          (ranked.slice(0, 3).reduce((s, r) => s + r.cents, 0) / totalSpent) *
            100,
        )
      : 0;
  const max = ranked[0]?.cents ?? 1;

  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight mb-3">
        Merchants
      </h1>
      <p className="italic text-ink-soft mb-8">
        Everyone you&apos;ve paid, ranked. Transfers between your own accounts
        don&apos;t count.
      </p>

      <div className="flex flex-wrap gap-0 -mx-3 mb-10 rule-b">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/merchants?range=${r.key}`}
            className={`label-caps px-3 py-2.5 ${
              r.key === range
                ? "!text-ink border-b-2 border-ink -mb-px"
                : "hover:text-ink"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="italic text-ink-faint">Nothing spent in this period.</p>
      ) : (
        <>
          <p className="mb-10 text-[17px]">
            <span className="display-figure text-[26px]">
              {formatCents(totalSpent)}
            </span>{" "}
            <span className="italic text-ink-soft">
              across {ranked.length} merchant
              {ranked.length === 1 ? "" : "s"}
              {ranked.length > 3 && (
                <> — the top three take {top3Share}% of it</>
              )}
            </span>
          </p>

          <div className="rule-t">
            {ranked.map((r, i) => (
              <div key={r.merchant} className="rule-b py-4">
                <div className="flex items-baseline gap-x-4 mb-2">
                  <span className="figure text-ink-faint w-7 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <span className="text-[16px] truncate">{r.merchant}</span>
                  <span className="hidden sm:flex items-baseline gap-1.5 text-[13px] text-ink-faint whitespace-nowrap">
                    <span
                      aria-hidden
                      className="self-center size-2 shrink-0"
                      style={{
                        background: categoryColor(
                          r.category?.colorToken ?? "cat-12",
                        ),
                      }}
                    />
                    {r.category?.name ?? "Uncategorized"}
                  </span>
                  <span className="figure text-[16px] ml-auto whitespace-nowrap">
                    {formatCents(r.cents)}
                  </span>
                </div>
                <div className="pl-11">
                  <svg
                    viewBox="0 0 100 1"
                    preserveAspectRatio="none"
                    className="w-full h-[4px] block"
                  >
                    <rect x="0" y="0" width="100" height="1" fill="var(--color-paper-warm)" />
                    <rect
                      x="0" y="0"
                      width={(r.cents / max) * 100} height="1"
                      fill={categoryColor(r.category?.colorToken ?? "cat-12")}
                    />
                  </svg>
                  <p className="mt-1.5 text-[13px] italic text-ink-faint">
                    {totalSpent > 0 &&
                      `${Math.round((r.cents / totalSpent) * 100)}% of spending · `}
                    {r.count === 1
                      ? "one visit"
                      : `${r.count} visits · ${formatCents(Math.round(r.cents / r.count))} a visit`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
