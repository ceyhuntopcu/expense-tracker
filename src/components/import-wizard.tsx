"use client";

import { useRef, useState, useTransition } from "react";
import type { Account, Category } from "@/db/schema";
import {
  commitImport,
  previewImport,
  type PreviewResult,
  type PreviewRow,
} from "@/lib/import/actions";
import { formatCents } from "@/lib/budget";

type Stage =
  | { name: "upload" }
  | {
      name: "preview";
      preview: Extract<PreviewResult, { ok: true }>;
      accountId: number;
      filename: string;
      rows: PreviewRow[];
      flipSigns: boolean;
    }
  | { name: "done"; added: number; skipped: number };

export function ImportWizard({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [stage, setStage] = useState<Stage>({ name: "upload" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);

  function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("accountId", String(accountId));
    startTransition(async () => {
      const result = await previewImport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStage({
        name: "preview",
        preview: result,
        accountId,
        filename: file.name,
        rows: result.rows,
        flipSigns: false,
      });
    });
  }

  function handleCommit() {
    if (stage.name !== "preview") return;
    startTransition(async () => {
      const result = await commitImport({
        accountId: stage.accountId,
        filename: stage.filename,
        format: stage.preview.format,
        rows: stage.rows,
        flipSigns: stage.flipSigns,
        skippedCount: stage.preview.skipped.length,
      });
      setStage({ name: "done", ...result });
    });
  }

  if (stage.name === "done") {
    return (
      <div className="rule-t rule-b py-10 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl">
          {stage.added} transaction{stage.added === 1 ? "" : "s"} entered
        </p>
        <p className="mt-2 italic text-ink-faint">
          {stage.skipped > 0 && `${stage.skipped} duplicates were skipped. `}
          The ledger has been updated.
        </p>
        <button
          onClick={() => setStage({ name: "upload" })}
          className="mt-6 label-caps underline hover:text-moss cursor-pointer"
        >
          Import another
        </button>
      </div>
    );
  }

  if (stage.name === "preview") {
    const { preview, rows, flipSigns } = stage;
    const sign = flipSigns ? -1 : 1;
    const newRows = rows.filter((r) => !r.duplicate);
    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <p className="text-[15px]">
            Read as <strong>{preview.parserLabel}</strong> —{" "}
            <span className="text-moss">{newRows.length} new</span>
            {preview.duplicateCount > 0 && (
              <span className="text-ink-faint">
                , {preview.duplicateCount} already in the ledger
              </span>
            )}
          </p>
          <label className="flex items-center gap-2 text-[15px] italic cursor-pointer">
            <input
              type="checkbox"
              checked={flipSigns}
              onChange={(e) =>
                setStage({ ...stage, flipSigns: e.target.checked })
              }
            />
            Amounts look reversed? Flip signs
          </label>
        </div>

        {preview.confidence === "low" && (
          <p className="mb-4 text-oxblood italic text-[15px]">
            This parse looks incomplete. Check the rows carefully — the CSV
            export from your bank is usually more reliable.
          </p>
        )}

        <div className="overflow-x-auto rule-t">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="rule-b">
                <th className="label-caps text-left py-2 pr-4">Date</th>
                <th className="label-caps text-left py-2 pr-4">Merchant</th>
                <th className="label-caps text-right py-2 pr-4">Amount</th>
                <th className="label-caps text-left py-2 pr-4">Category</th>
                <th className="label-caps text-center py-2">Transfer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.dedupeHash}
                  className={`rule-b ${row.duplicate ? "opacity-40" : ""}`}
                >
                  <td className="figure py-2 pr-4 whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="py-2 pr-4" title={row.description}>
                    {row.merchant}
                    {row.duplicate && (
                      <span className="label-caps ml-2">dup</span>
                    )}
                  </td>
                  <td
                    className={`figure py-2 pr-4 text-right whitespace-nowrap ${
                      row.amountCents * sign < 0 ? "" : "text-moss"
                    }`}
                  >
                    {formatCents(row.amountCents * sign)}
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={row.categoryId ?? ""}
                      disabled={row.duplicate}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = {
                          ...row,
                          categoryId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        };
                        setStage({ ...stage, rows: next });
                      }}
                      className="bg-transparent border-0 border-b border-rule rounded-none py-0.5 focus:outline-none focus:border-moss cursor-pointer max-w-40"
                    >
                      <option value="">— uncategorized —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.isTransfer}
                      disabled={row.duplicate}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...row, isTransfer: e.target.checked };
                        setStage({ ...stage, rows: next });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {preview.skipped.length > 0 && (
          <details className="mt-4 text-[14px] text-ink-faint">
            <summary className="cursor-pointer italic">
              {preview.skipped.length} line{preview.skipped.length === 1 ? "" : "s"}{" "}
              couldn&apos;t be read
            </summary>
            <ul className="mt-2 font-[family-name:var(--font-mono)] text-[12px] space-y-1">
              {preview.skipped.slice(0, 20).map((line, i) => (
                <li key={i} className="truncate">{line}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleCommit}
            disabled={pending || newRows.length === 0}
            className="bg-ink text-cream px-8 py-2.5 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer"
          >
            {pending ? "Entering…" : `Enter ${newRows.length} into the ledger`}
          </button>
          <button
            onClick={() => setStage({ name: "upload" })}
            disabled={pending}
            className="label-caps underline hover:text-oxblood cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-t rule-b py-8">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] items-end">
        <div className="space-y-5">
          <label className="block">
            <span className="label-caps">Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className="mt-1.5 block w-full max-w-sm bg-transparent border-0 border-b border-rule-strong rounded-none py-1.5 font-[family-name:var(--font-mono)] text-[15px] focus:outline-none focus:border-moss cursor-pointer"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-caps">Statement file (.csv or .pdf)</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              className="mt-1.5 block text-[15px] file:mr-4 file:bg-ink file:text-cream file:border-0 file:px-4 file:py-1.5 file:label-caps file:cursor-pointer cursor-pointer"
            />
          </label>
        </div>
        <button
          onClick={handlePreview}
          disabled={pending}
          className="bg-ink text-cream px-8 py-2.5 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Reading…" : "Preview"}
        </button>
      </div>
      {error && <p className="mt-4 text-oxblood italic">{error}</p>}
    </div>
  );
}
