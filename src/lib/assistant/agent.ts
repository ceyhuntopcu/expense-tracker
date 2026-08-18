import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { fireworks } from "@ai-sdk/fireworks";
import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { allocations, categories, incomes, transactions } from "@/db/schema";
import {
  allocationBudgetCents,
  monthlyIncomeCents,
  monthOf,
  monthRange,
  shiftMonth,
} from "@/lib/budget";
import { monthTransactions, summarizeMonth, userAccountIds } from "@/lib/queries";

const MODEL = fireworks("accounts/fireworks/models/kimi-k2p6");

const dollars = (cents: number) => Math.round(cents) / 100;

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe("Month as YYYY-MM");

/**
 * Build the ledger assistant for one authenticated user. Every tool closes
 * over the caller's userId — the model has no way to reach other users' rows,
 * and there are no write tools.
 */
export function createLedgerAgent(userId: number, today: string) {
  const getCategories = () =>
    db.query.categories.findMany({ where: eq(categories.userId, userId) });

  return new ToolLoopAgent({
    model: MODEL,
    instructions: `You are the assistant inside "Ledger", a personal expense tracker. You answer questions about the user's own finances using the tools provided — always call tools for numbers rather than guessing, and never invent figures. Amounts are Canadian dollars; negative = money out. Transfers between the user's own accounts are excluded from spending. Today is ${today}, so "this month" means ${today.slice(0, 7)}. Be concise and concrete: lead with the number, add one or two sentences of context. Write plain prose — no markdown headings, bullets, or tables; **bold** is allowed for key figures only. If data is missing for a period, say so and suggest importing a statement. You are read-only — if asked to change something, explain where in the app to do it (Transactions to recategorize, Budget for allocations, Import for statements, Settings for accounts/categories/rules).`,
    stopWhen: stepCountIs(12),
    tools: {
      get_month_summary: tool({
        description:
          "Totals for one month: spent, received, kept, spending by category, and top merchants. Transfers excluded.",
        inputSchema: z.object({ month: monthSchema }),
        execute: async ({ month }) => {
          const accountIds = await userAccountIds(userId);
          const rows = await monthTransactions(accountIds, month, month);
          const summary = summarizeMonth(rows, month);
          const cats = await getCategories();
          const byId = new Map(cats.map((c) => [c.id, c.name]));
          return {
            month,
            spent: dollars(summary.spentCents),
            received: dollars(summary.incomeCents),
            kept: dollars(summary.incomeCents - summary.spentCents),
            byCategory: [...summary.byCategory.entries()]
              .map(([id, cents]) => ({
                category: id !== null ? (byId.get(id) ?? "Unknown") : "Uncategorized",
                spent: dollars(cents),
              }))
              .sort((a, b) => b.spent - a.spent),
            topMerchants: [...summary.byMerchant.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([merchant, cents]) => ({ merchant, spent: dollars(cents) })),
          };
        },
      }),

      search_transactions: tool({
        description:
          "Search the user's transactions by merchant/description text, month, and/or category name. Returns newest first.",
        inputSchema: z.object({
          query: z.string().optional().describe("Text to match in merchant or description"),
          month: monthSchema.optional(),
          category: z
            .string()
            .optional()
            .describe(
              "Category name, e.g. 'Groceries'. Pass 'Uncategorized' for transactions without a category.",
            ),
          limit: z.number().int().min(1).max(50).default(15),
        }),
        execute: async ({ query, month, category, limit }) => {
          const accountIds = await userAccountIds(userId);
          if (accountIds.length === 0) return { transactions: [] };
          const filters: SQL[] = [inArray(transactions.accountId, accountIds)];
          if (month) {
            const range = monthRange(month);
            filters.push(gte(transactions.date, range.start));
            filters.push(lt(transactions.date, range.endExclusive));
          }
          if (query) {
            const like = `%${query}%`;
            const match = or(
              ilike(transactions.merchant, like),
              ilike(transactions.description, like),
            );
            if (match) filters.push(match);
          }
          if (category) {
            if (/^(uncategorized|none|no category)$/i.test(category.trim())) {
              filters.push(isNull(transactions.categoryId));
            } else {
              const cats = await getCategories();
              const cat = cats.find(
                (c) => c.name.toLowerCase() === category.toLowerCase(),
              );
              if (!cat) {
                return {
                  error: `No category named "${category}"`,
                  availableCategories: [
                    ...cats.map((c) => c.name),
                    "Uncategorized",
                  ],
                };
              }
              filters.push(eq(transactions.categoryId, cat.id));
            }
          }
          const rows = await db.query.transactions.findMany({
            where: and(...filters),
            orderBy: [desc(transactions.date), desc(transactions.id)],
            limit,
          });
          const cats = await getCategories();
          const byId = new Map(cats.map((c) => [c.id, c.name]));
          return {
            transactions: rows.map((t) => ({
              date: t.date,
              merchant: t.merchant,
              amount: dollars(t.amountCents),
              category:
                t.categoryId !== null
                  ? (byId.get(t.categoryId) ?? "Unknown")
                  : "Uncategorized",
              isTransfer: t.isTransfer,
            })),
          };
        },
      }),

      get_budget_status: tool({
        description:
          "The user's budget plan vs actual spending for a month: each allocated category's percent, budgeted dollars, actual dollars, and remaining.",
        inputSchema: z.object({ month: monthSchema }),
        execute: async ({ month }) => {
          const [userIncomes, userAllocations, cats, accountIds] =
            await Promise.all([
              db.query.incomes.findMany({ where: eq(incomes.userId, userId) }),
              db.query.allocations.findMany({
                where: eq(allocations.userId, userId),
              }),
              getCategories(),
              userAccountIds(userId),
            ]);
          const monthlyIncome = monthlyIncomeCents(userIncomes);
          const rows = await monthTransactions(accountIds, month, month);
          const summary = summarizeMonth(rows, month);
          const byId = new Map(cats.map((c) => [c.id, c.name]));
          const totalPercent = userAllocations.reduce(
            (s, a) => s + Number(a.percent),
            0,
          );
          return {
            month,
            monthlyIncomeNormalized: dollars(monthlyIncome),
            totalAllocatedPercent: totalPercent,
            unallocatedPercent: Math.max(0, 100 - totalPercent),
            allocations: userAllocations.map((a) => {
              const budget = allocationBudgetCents(monthlyIncome, a.percent);
              const actual = summary.byCategory.get(a.categoryId) ?? 0;
              return {
                category: byId.get(a.categoryId) ?? "Unknown",
                percent: Number(a.percent),
                budgeted: dollars(budget),
                actual: dollars(actual),
                remaining: dollars(budget - actual),
                overBudget: actual > budget,
              };
            }),
          };
        },
      }),

      get_income: tool({
        description:
          "The user's income sources with pay frequency and the normalized monthly total.",
        inputSchema: z.object({}),
        execute: async () => {
          const userIncomes = await db.query.incomes.findMany({
            where: eq(incomes.userId, userId),
          });
          return {
            sources: userIncomes.map((i) => ({
              label: i.label,
              amount: dollars(i.amountCents),
              frequency: i.frequency,
            })),
            monthlyTotalNormalized: dollars(monthlyIncomeCents(userIncomes)),
          };
        },
      }),
    },
  });
}

export type LedgerAgent = ReturnType<typeof createLedgerAgent>;

export { monthOf, shiftMonth };
