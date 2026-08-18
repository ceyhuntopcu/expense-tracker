"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { allocations, categories, incomes } from "@/db/schema";

const incomeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z.coerce.number().positive().max(10_000_000),
  frequency: z.enum(["monthly", "semimonthly", "biweekly", "weekly"]),
});

export async function addIncome(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const parsed = incomeSchema.safeParse({
    label: formData.get("label"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) return;

  await db.insert(incomes).values({
    userId,
    label: parsed.data.label,
    amountCents: Math.round(parsed.data.amount * 100),
    frequency: parsed.data.frequency,
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  revalidatePath("/budget");
}

export async function deleteIncome(incomeId: number): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(incomes)
    .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)));
  revalidatePath("/budget");
}

const allocationsSchema = z
  .array(
    z.object({
      categoryId: z.number().int(),
      percent: z.number().min(0).max(100),
    }),
  )
  .refine(
    (rows) => rows.reduce((s, r) => s + r.percent, 0) <= 100.001,
    "Allocations exceed 100% of income.",
  );

export async function saveAllocations(
  entries: { categoryId: number; percent: number }[],
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = allocationsSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const owned = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
    columns: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));
  if (parsed.data.some((e) => !ownedIds.has(e.categoryId))) {
    return { error: "Unknown category." };
  }

  await db.delete(allocations).where(eq(allocations.userId, userId));
  const nonZero = parsed.data.filter((e) => e.percent > 0);
  if (nonZero.length > 0) {
    await db.insert(allocations).values(
      nonZero.map((e) => ({
        userId,
        categoryId: e.categoryId,
        percent: e.percent.toFixed(2),
      })),
    );
  }
  revalidatePath("/budget");
  return {};
}
