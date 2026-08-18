"use client";

import { useTransition } from "react";
import type { Category } from "@/db/schema";
import {
  setTransactionCategory,
  setTransactionTransfer,
} from "@/lib/transaction-actions";
import { formatCents } from "@/lib/budget";
import { categoryColor } from "@/components/charts";

export type TransactionRow = {
  id: number;
  date: string;
  merchant: string;
  description: string;
  amountCents: number;
  categoryId: number | null;
  isTransfer: boolean;
  account: string;
};

/** "2026-07-30" → "Thursday, July 30" — no timezone drift. */
function dayHeading(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  });
  const monthName = utc.toLocaleDateString("en-CA", {
    month: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${monthName} ${d}, ${y}`;
}

export function TransactionTable({
  rows,
  categories,
}: {
  rows: TransactionRow[];
  categories: Category[];
}) {
  const [, startTransition] = useTransition();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  if (rows.length === 0) {
    return (
      <p className="italic text-ink-faint rule-t pt-8">
        Nothing here — adjust the filters, or import a statement.
      </p>
    );
  }

  // Group by day (rows arrive sorted newest first).
  const days: { date: string; entries: TransactionRow[] }[] = [];
  for (const row of rows) {
    const last = days.at(-1);
    if (last && last.date === row.date) last.entries.push(row);
    else days.push({ date: row.date, entries: [row] });
  }

  return (
    <div className="rule-t">
      {days.map(({ date, entries }) => {
        const dayOut = entries
          .filter((e) => !e.isTransfer && e.amountCents < 0)
          .reduce((s, e) => s - e.amountCents, 0);
        return (
          <section key={date} className="pt-7 pb-2">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <h3 className="font-[family-name:var(--font-display)] italic text-[17px] text-ink-soft">
                {dayHeading(date)}
              </h3>
              {dayOut > 0 && (
                <span className="text-[13px] italic text-ink-faint whitespace-nowrap">
                  spent <span className="figure">{formatCents(dayOut)}</span>
                </span>
              )}
            </div>

            {entries.map((row) => {
              const category =
                row.categoryId !== null
                  ? categoryById.get(row.categoryId)
                  : undefined;
              return (
                <div
                  key={row.id}
                  className={`rule-b py-4 grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_auto] items-baseline gap-x-6 gap-y-2 ${
                    row.isTransfer ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[16px] truncate" title={row.description}>
                      {row.merchant}
                    </p>
                    <p className="text-[13px] italic text-ink-faint truncate">
                      {row.account}
                    </p>
                  </div>

                  <div className="col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto flex items-baseline gap-4">
                    <span
                      aria-hidden
                      className="self-center size-2 shrink-0"
                      style={{
                        background: categoryColor(
                          category?.colorToken ?? "cat-12",
                        ),
                      }}
                    />
                    <select
                      defaultValue={row.categoryId ?? ""}
                      onChange={(e) => {
                        const categoryId = e.target.value
                          ? Number(e.target.value)
                          : null;
                        const createRule =
                          categoryId !== null &&
                          confirm(
                            `Always file "${row.merchant}" under ${
                              categoryById.get(categoryId)?.name
                            }? OK creates a rule for future imports; Cancel applies to this transaction only.`,
                          );
                        startTransition(() =>
                          setTransactionCategory(row.id, categoryId, {
                            createRule,
                          }),
                        );
                      }}
                      className="bg-transparent border-0 border-b border-rule rounded-none py-0.5 text-[14px] focus:outline-none focus:border-moss cursor-pointer max-w-44"
                    >
                      <option value="">— uncategorized —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-[12px] label-caps cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        defaultChecked={row.isTransfer}
                        onChange={(e) =>
                          startTransition(() =>
                            setTransactionTransfer(row.id, e.target.checked),
                          )
                        }
                        title="Transfers are excluded from spending"
                      />
                      transfer
                    </label>
                  </div>

                  <span
                    className={`figure text-[16px] text-right whitespace-nowrap ${
                      row.isTransfer
                        ? "text-ink-faint"
                        : row.amountCents >= 0
                          ? "text-moss"
                          : ""
                    }`}
                  >
                    {formatCents(row.amountCents)}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
