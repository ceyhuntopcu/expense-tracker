"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, categories, rules } from "@/db/schema";

const accountSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  bank: z.enum(["wealthsimple", "scotiabank"]),
  kind: z.enum(["debit", "credit"]),
});

export async function addAccount(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = accountSchema.safeParse({
    nickname: formData.get("nickname"),
    bank: formData.get("bank"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return;
  await db.insert(accounts).values({ userId, ...parsed.data });
  revalidatePath("/", "layout");
}

export async function deleteAccount(accountId: number): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  revalidatePath("/", "layout");
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  group: z.enum(["needs", "wants", "savings", "income", "transfer"]),
});

export async function addCategory(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group"),
  });
  if (!parsed.success) return;

  const existing = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
  });
  const colorToken = `cat-${(existing.length % 12) + 1}`;
  await db.insert(categories).values({
    userId,
    name: parsed.data.name,
    group: parsed.data.group,
    colorToken,
    sortOrder: existing.length,
  });
  revalidatePath("/", "layout");
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  revalidatePath("/", "layout");
}

export async function deleteRule(ruleId: number): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(rules)
    .where(and(eq(rules.id, ruleId), eq(rules.userId, userId)));
  revalidatePath("/", "layout");
}
