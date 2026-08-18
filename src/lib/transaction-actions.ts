"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, categories, rules, transactions } from "@/db/schema";

async function ownedTransaction(userId: number, transactionId: number) {
  const [row] = await db
    .select({ id: transactions.id, accountId: transactions.accountId })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, transactionId), eq(accounts.userId, userId)));
  if (!row) throw new Error("Transaction not found");
  return row;
}

export async function setTransactionCategory(
  transactionId: number,
  categoryId: number | null,
  options?: { createRule?: boolean },
) {
  const userId = await requireUserId();
  await ownedTransaction(userId, transactionId);

  if (categoryId !== null) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.id, categoryId), eq(categories.userId, userId)),
    });
    if (!category) throw new Error("Category not found");
  }

  await db
    .update(transactions)
    .set({ categoryId })
    .where(eq(transactions.id, transactionId));

  if (options?.createRule && categoryId !== null) {
    const txn = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });
    if (txn) {
      await db.insert(rules).values({
        userId,
        pattern: txn.merchant.toLowerCase(),
        categoryId,
        priority: 0,
      });
      // Recategorize every uncategorized transaction that now matches.
      const userAccounts = await db.query.accounts.findMany({
        where: eq(accounts.userId, userId),
      });
      const all = await db.query.transactions.findMany({
        where: inArray(
          transactions.accountId,
          userAccounts.map((a) => a.id),
        ),
      });
      const matching = all
        .filter((t) => t.categoryId === null)
        .filter((t) =>
          `${t.description} ${t.merchant}`
            .toLowerCase()
            .includes(txn.merchant.toLowerCase()),
        )
        .map((t) => t.id);
      if (matching.length > 0) {
        await db
          .update(transactions)
          .set({ categoryId })
          .where(inArray(transactions.id, matching));
      }
    }
  }

  revalidatePath("/", "layout");
}

export async function setTransactionTransfer(
  transactionId: number,
  isTransfer: boolean,
) {
  const userId = await requireUserId();
  await ownedTransaction(userId, transactionId);
  await db
    .update(transactions)
    .set({ isTransfer })
    .where(eq(transactions.id, transactionId));
  revalidatePath("/", "layout");
}
