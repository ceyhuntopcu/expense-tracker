import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { categories, incomes } from "@/db/schema";
import {
  formatCents,
  monthlyIncomeCents,
  monthRange,
  shiftMonth,
} from "@/lib/budget";
import { detectRecurring } from "@/lib/recurring";
import { transactionsBetween, userAccountIds } from "@/lib/queries";
import { categoryColor } from "@/components/charts";

export const metadata = { title: "Recurring" };

const WINDOW_MONTHS = 6;

export default async function RecurringPage() {
  const userId = await requireUserId();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const start = `${shiftMonth(thisMonth, -(WINDOW_MONTHS - 1))}-01`;
  const end = monthRange(thisMonth).endExclusive;

  const [accountIds, userCategories, userIncomes] = await Promise.all([
    userAccountIds(userId),
    db.query.categories.findMany({ where: eq(categories.userId, userId) }),
    db.query.incomes.findMany({ where: eq(incomes.userId, userId) }),
  ]);
  const categoryById = new Map(userCategories.map((c) => [c.id, c]));

  const rows = await transactionsBetween(accountIds, start, end);
  const recurring = detectRecurring(rows, WINDOW_MONTHS);

  const monthlyLoad = recurring.reduce((s, r) => s + r.typicalCents, 0);
  const monthlyIncome = monthlyIncomeCents(userIncomes);
  const loadShare =
    monthlyIncome > 0 ? Math.round((monthlyLoad / monthlyIncome) * 100) : null;
  const max = recurring[0]?.typicalCents ?? 1;

  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-tight mb-3">
        Standing orders
      </h1>
      <p className="italic text-ink-soft mb-12">
        Charges that come back every month whether you think about them or not
        — rent, subscriptions, memberships. Found by watching the last{" "}
        {WINDOW_MONTHS} months for steady, repeating amounts.
      </p>

      {recurring.length === 0 ? (
        <p className="italic text-ink-faint rule-t pt-8">
          Nothing recurring detected yet — this view needs at least three
          months of imported statements to find patterns.
        </p>
      ) : (
        <>
          <section className="double-rule pt-8 mb-14 grid sm:grid-cols-3 gap-x-8 gap-y-8">
            <div>
              <p className="label-caps mb-3">Every month</p>
              <p className="display-figure text-[2.8rem] leading-none">
                {formatCents(monthlyLoad)}
              </p>
              {loadShare !== null && (
                <p className="mt-3 italic text-ink-faint text-[14px]">
                  {loadShare}% of your income, spoken for
                </p>
              )}
            </div>
            <div>
              <p className="label-caps mb-3">Over a year</p>
              <p className="display-figure text-[2.8rem] leading-none">
                {formatCents(monthlyLoad * 12)}
              </p>
            </div>
            <div>
              <p className="label-caps mb-3">Commitments</p>
              <p className="display-figure text-[2.8rem] leading-none">
                {recurring.length}
              </p>
            </div>
          </section>

          <div className="rule-t">
            {recurring.map((r) => {
              const category =
                r.categoryId !== null
                  ? categoryById.get(r.categoryId)
                  : undefined;
              return (
                <div key={r.merchant} className="rule-b py-5">
                  <div className="flex items-baseline gap-x-4 mb-2">
                    <span className="text-[17px] truncate">{r.merchant}</span>
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
                      {category?.name ?? "Uncategorized"}
                    </span>
                    <span className="display-figure text-[22px] ml-auto whitespace-nowrap">
                      {formatCents(r.typicalCents)}
                      <span className="font-[family-name:var(--font-body)] italic text-[14px] text-ink-faint">
                        {" "}
                        / month
                      </span>
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 100 1"
                    preserveAspectRatio="none"
                    className="w-full h-[5px] block"
                  >
                    <rect x="0" y="0" width="100" height="1" fill="var(--color-paper-warm)" />
                    <rect
                      x="0" y="0"
                      width={(r.typicalCents / max) * 100} height="1"
                      fill={categoryColor(category?.colorToken ?? "cat-12")}
                    />
                  </svg>
                  <p className="mt-2 text-[13px] italic text-ink-faint">
                    {formatCents(r.annualizedCents)} a year · seen in{" "}
                    {r.monthsSeen} of the last {r.monthsInWindow} months · last
                    charged {r.lastDate}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
