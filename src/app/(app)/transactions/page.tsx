import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { monthRange } from "@/lib/budget";
import { TransactionTable } from "@/components/transaction-table";
import { TransactionFilters } from "@/components/transaction-filters";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    account?: string;
    category?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const userId = await requireUserId();

  const [userAccounts, userCategories] = await Promise.all([
    db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: (c, { asc }) => asc(c.sortOrder),
    }),
  ]);
  const accountIds = userAccounts.map((a) => a.id);

  const filters: SQL[] = [];
  if (accountIds.length > 0) {
    filters.push(inArray(transactions.accountId, accountIds));
  }
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const range = monthRange(params.month);
    filters.push(gte(transactions.date, range.start));
    filters.push(lt(transactions.date, range.endExclusive));
  }
  if (params.account) {
    const id = Number(params.account);
    if (accountIds.includes(id)) filters.push(eq(transactions.accountId, id));
  }
  if (params.category === "none") {
    filters.push(eq(transactions.isTransfer, false));
  } else if (params.category) {
    filters.push(eq(transactions.categoryId, Number(params.category)));
  }
  if (params.q) {
    const like = `%${params.q}%`;
    const textMatch = or(
      ilike(transactions.description, like),
      ilike(transactions.merchant, like),
    );
    if (textMatch) filters.push(textMatch);
  }

  const rows =
    accountIds.length > 0
      ? await db.query.transactions.findMany({
          where: and(...filters),
          orderBy: [desc(transactions.date), desc(transactions.id)],
          limit: 500,
        })
      : [];

  const uncategorized = params.category === "none";
  const visible = uncategorized
    ? rows.filter((r) => r.categoryId === null)
    : rows;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight mb-8">
        Transactions
      </h1>
      <TransactionFilters
        accounts={userAccounts}
        categories={userCategories}
        current={params}
      />
      <TransactionTable
        rows={visible.map((t) => ({
          id: t.id,
          date: t.date,
          merchant: t.merchant,
          description: t.description,
          amountCents: t.amountCents,
          categoryId: t.categoryId,
          isTransfer: t.isTransfer,
          account:
            userAccounts.find((a) => a.id === t.accountId)?.nickname ?? "—",
        }))}
        categories={userCategories}
      />
    </div>
  );
}
