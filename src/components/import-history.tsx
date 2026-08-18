"use client";

import { useTransition } from "react";
import { undoImport } from "@/lib/import/actions";

export function ImportHistory({
  history,
}: {
  history: {
    id: number;
    filename: string;
    format: string;
    rowsAdded: number;
    rowsSkipped: number;
    account: string;
    date: string;
  }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rule-t">
      {history.map((h) => (
        <div
          key={h.id}
          className="rule-b py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[15px]"
        >
          <span className="figure text-ink-faint">{h.date}</span>
          <span className="font-medium">{h.filename}</span>
          <span className="label-caps">{h.format}</span>
          <span className="text-ink-soft">
            {h.rowsAdded} added
            {h.rowsSkipped > 0 && `, ${h.rowsSkipped} skipped`}
          </span>
          <span className="italic text-ink-faint">{h.account}</span>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Undo this import? ${h.rowsAdded} transactions will be removed.`)) {
                startTransition(() => undoImport(h.id));
              }
            }}
            className="ml-auto label-caps hover:text-oxblood cursor-pointer disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      ))}
    </div>
  );
}
