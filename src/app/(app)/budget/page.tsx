import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { allocations, categories, incomes } from "@/db/schema";
import {
  allocationBudgetCents,
  formatCents,
  monthlyIncomeCents,
  monthLabel,
} from "@/lib/budget";
import { monthTransactions, summarizeMonth, userAccountIds } from "@/lib/queries";
import { IncomeSection } from "@/components/income-section";
import { AllocationEditor } from "@/components/allocation-editor";
import { BudgetBar } from "@/components/charts";

export const metadata = { title: "Budget" };

export default async function BudgetPage() {
  const userId = await requireUserId();
  const month = new Date().toISOString().slice(0, 7);

  const [userIncomes, userAllocations, userCategories, accountIds] =
    await Promise.all([
      db.query.incomes.findMany({ where: eq(incomes.userId, userId) }),
      db.query.allocations.findMany({ where: eq(allocations.userId, userId) }),
      db.query.categories.findMany({
        where: eq(categories.userId, userId),
        orderBy: (c, { asc }) => asc(c.sortOrder),
      }),
      userAccountIds(userId),
    ]);

  const rows = await monthTransactions(accountIds, month, month);
  const summary = summarizeMonth(rows, month);
  const monthlyIncome = monthlyIncomeCents(userIncomes);

  const spendCategories = userCategories.filter(
    (c) => c.group !== "income" && c.group !== "transfer",
  );

  const budgetRows = userAllocations
    .map((a) => {
      const category = userCategories.find((c) => c.id === a.categoryId);
      if (!category) return null;
      return {
        name: category.name,
        colorToken: category.colorToken,
        percent: Number(a.percent),
        budgetCents: allocationBudgetCents(monthlyIncome, a.percent),
        actualCents: summary.byCategory.get(a.categoryId) ?? 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.budgetCents - a.budgetCents);

  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight mb-2">
        The plan for the paycheck
      </h1>
      <p className="italic text-ink-soft mb-10">
        Enter what you earn, decide what share of it goes where, and watch the
        month hold the line — or not.
      </p>

      <IncomeSection
        incomes={userIncomes.map((i) => ({
          id: i.id,
          label: i.label,
          amountCents: i.amountCents,
          frequency: i.frequency,
        }))}
        monthlyIncomeCents={monthlyIncome}
      />

      <section className="mt-14">
        <h2 className="label-caps rule-b pb-2 mb-6">Allocations</h2>
        {monthlyIncome === 0 ? (
          <p className="italic text-ink-faint">
            Add an income source first — allocations are percentages of it.
          </p>
        ) : (
          <AllocationEditor
            categories={spendCategories.map((c) => ({
              id: c.id,
              name: c.name,
              colorToken: c.colorToken,
            }))}
            initial={userAllocations.map((a) => ({
              categoryId: a.categoryId,
              percent: Number(a.percent),
            }))}
            monthlyIncomeCents={monthlyIncome}
          />
        )}
      </section>

      {budgetRows.length > 0 && (
        <section className="mt-14">
          <h2 className="label-caps rule-b pb-2 mb-6">
            {monthLabel(month)} — plan vs. reality
          </h2>
          <div className="space-y-5">
            {budgetRows.map((row) => {
              const over = row.actualCents > row.budgetCents;
              return (
                <div key={row.name}>
                  <div className="flex items-baseline justify-between mb-1 text-[15px]">
                    <span>
                      {row.name}
                      <span className="text-ink-faint italic ml-2">
                        {row.percent}%
                      </span>
                    </span>
                    <span className="figure text-[14px]">
                      {formatCents(row.actualCents)}
                      <span className="text-ink-faint">
                        {" "}/ {formatCents(row.budgetCents)}
                      </span>
                    </span>
                  </div>
                  <BudgetBar
                    budgetCents={row.budgetCents}
                    actualCents={row.actualCents}
                    colorToken={row.colorToken}
                  />
                  {over && (
                    <p className="mt-1 text-[13px] italic text-oxblood">
                      {formatCents(row.actualCents - row.budgetCents)} over the
                      plan
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
