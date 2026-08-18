import { db } from "@/db";
import { accounts, categories } from "@/db/schema";

type CategoryGroup = "needs" | "wants" | "savings" | "income" | "transfer";

export const DEFAULT_CATEGORIES: {
  name: string;
  group: CategoryGroup;
  colorToken: string;
}[] = [
  { name: "Groceries", group: "needs", colorToken: "cat-1" },
  { name: "Rent & Housing", group: "needs", colorToken: "cat-2" },
  { name: "Bills & Utilities", group: "needs", colorToken: "cat-3" },
  { name: "Transport", group: "needs", colorToken: "cat-4" },
  { name: "Health", group: "needs", colorToken: "cat-5" },
  { name: "Dining & Coffee", group: "wants", colorToken: "cat-6" },
  { name: "Entertainment", group: "wants", colorToken: "cat-7" },
  { name: "Shopping", group: "wants", colorToken: "cat-8" },
  { name: "Subscriptions", group: "wants", colorToken: "cat-9" },
  { name: "Savings & Investing", group: "savings", colorToken: "cat-10" },
  { name: "Income", group: "income", colorToken: "cat-11" },
  { name: "Transfers", group: "transfer", colorToken: "cat-12" },
  { name: "Other", group: "wants", colorToken: "cat-12" },
];

const DEFAULT_ACCOUNTS: {
  bank: "wealthsimple" | "scotiabank";
  kind: "debit" | "credit";
  nickname: string;
}[] = [
  { bank: "wealthsimple", kind: "debit", nickname: "Wealthsimple Cash" },
  { bank: "wealthsimple", kind: "credit", nickname: "Wealthsimple Credit" },
  { bank: "scotiabank", kind: "debit", nickname: "Scotiabank Chequing" },
];

/** Seed a fresh user with default categories and the user's known accounts. */
export async function seedNewUser(userId: number) {
  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c, i) => ({
      userId,
      name: c.name,
      group: c.group,
      colorToken: c.colorToken,
      sortOrder: i,
    })),
  );
  await db.insert(accounts).values(
    DEFAULT_ACCOUNTS.map((a) => ({ userId, ...a })),
  );
}
