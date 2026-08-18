"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, imports, rules, transactions, categories } from "@/db/schema";
import { detectParser } from "./registry";
import { categorize } from "./categorize";
import { cleanMerchant, withDedupeHashes } from "./normalize";

export type PreviewRow = {
  date: string;
  description: string;
  merchant: string;
  amountCents: number;
  dedupeHash: string;
  duplicate: boolean;
  categoryId: number | null;
  isTransfer: boolean;
};

export type PreviewResult =
  | {
      ok: true;
      parserLabel: string;
      format: "csv" | "pdf";
      confidence: "high" | "low";
      rows: PreviewRow[];
      skipped: string[];
      newCount: number;
      duplicateCount: number;
    }
  | { ok: false; error: string };

async function ownedAccount(userId: number, accountId: number) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.userId, userId)),
  });
  if (!account) throw new Error("Account not found");
  return account;
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const userId = await requireUserId();
  const accountId = Number(formData.get("accountId"));
  const file = formData.get("file");
  if (!(file instanceof File) || !accountId) {
    return { ok: false, error: "Pick a file and an account." };
  }

  const account = await ownedAccount(userId, accountId);
  const buffer = await file.arrayBuffer();
  const isPdf =
    file.name.toLowerCase().endsWith(".pdf") ||
    file.type === "application/pdf";

  let text: string;
  if (isPdf) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text;
    } catch {
      return { ok: false, error: "Couldn't read that PDF. Try the CSV export instead." };
    }
  } else {
    text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
  }

  const format = isPdf ? "pdf" : "csv";
  const parser = detectParser(text, format, account.bank);
  if (!parser) {
    return { ok: false, error: "Couldn't recognize this file's format." };
  }

  const parsed = parser.parse(text);
  if (parsed.transactions.length === 0) {
    return {
      ok: false,
      error:
        format === "pdf"
          ? "No transactions found in this PDF. PDF layouts vary — the CSV export from your bank is more reliable."
          : "No transactions found in this file.",
    };
  }

  const hashed = withDedupeHashes(accountId, parsed.transactions);
  const existing = await db
    .select({ dedupeHash: transactions.dedupeHash })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inArray(
          transactions.dedupeHash,
          hashed.map((t) => t.dedupeHash),
        ),
      ),
    );
  const existingHashes = new Set(existing.map((r) => r.dedupeHash));

  const [userRules, userCategories] = await Promise.all([
    db.query.rules.findMany({ where: eq(rules.userId, userId) }),
    db.query.categories.findMany({ where: eq(categories.userId, userId) }),
  ]);

  const rows: PreviewRow[] = hashed.map((txn) => {
    const merchant = cleanMerchant(txn.description);
    const cat = categorize(
      txn.description,
      merchant,
      txn.amountCents,
      userRules,
      userCategories,
    );
    return {
      ...txn,
      merchant,
      duplicate: existingHashes.has(txn.dedupeHash),
      categoryId: cat.categoryId,
      isTransfer: cat.isTransfer,
    };
  });

  const duplicateCount = rows.filter((r) => r.duplicate).length;
  return {
    ok: true,
    parserLabel: parser.label,
    format,
    confidence: parsed.confidence,
    rows,
    skipped: parsed.skipped,
    newCount: rows.length - duplicateCount,
    duplicateCount,
  };
}

export type CommitPayload = {
  accountId: number;
  filename: string;
  format: "csv" | "pdf";
  rows: PreviewRow[];
  flipSigns: boolean;
  skippedCount: number;
};

export async function commitImport(payload: CommitPayload) {
  const userId = await requireUserId();
  await ownedAccount(userId, payload.accountId);

  const newRows = payload.rows.filter((r) => !r.duplicate);
  if (newRows.length === 0) {
    return { added: 0, skipped: payload.rows.length };
  }

  const [importRecord] = await db
    .insert(imports)
    .values({
      accountId: payload.accountId,
      filename: payload.filename.slice(0, 200),
      format: payload.format,
      rowsAdded: newRows.length,
      rowsSkipped: payload.rows.length - newRows.length + payload.skippedCount,
    })
    .returning();

  const inserted = await db
    .insert(transactions)
    .values(
      newRows.map((r) => ({
        accountId: payload.accountId,
        date: r.date,
        description: r.description,
        merchant: r.merchant,
        amountCents: payload.flipSigns ? -r.amountCents : r.amountCents,
        categoryId: r.categoryId,
        isTransfer: r.isTransfer,
        importId: importRecord.id,
        dedupeHash: r.dedupeHash,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: transactions.id });

  await db
    .update(imports)
    .set({ rowsAdded: inserted.length })
    .where(eq(imports.id, importRecord.id));

  revalidatePath("/", "layout");
  return { added: inserted.length, skipped: payload.rows.length - inserted.length };
}

export async function undoImport(importId: number) {
  const userId = await requireUserId();
  const record = await db.query.imports.findFirst({
    where: eq(imports.id, importId),
  });
  if (!record) throw new Error("Import not found");
  await ownedAccount(userId, record.accountId);

  await db.delete(transactions).where(eq(transactions.importId, importId));
  await db.delete(imports).where(eq(imports.id, importId));
  revalidatePath("/", "layout");
}
