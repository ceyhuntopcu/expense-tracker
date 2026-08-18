"use client";

import { useMemo, useState, useTransition } from "react";
import { saveAllocations } from "@/lib/budget-actions";
import { formatCents } from "@/lib/budget";
import { categoryColor } from "@/components/charts";

export function AllocationEditor({
  categories,
  initial,
  monthlyIncomeCents,
}: {
  categories: { id: number; name: string; colorToken: string }[];
  initial: { categoryId: number; percent: number }[];
  monthlyIncomeCents: number;
}) {
  const [percents, setPercents] = useState<Record<number, number>>(() =>
    Object.fromEntries(initial.map((a) => [a.categoryId, a.percent])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = useMemo(
    () => Object.values(percents).reduce((s, p) => s + (p || 0), 0),
    [percents],
  );
  const overCommitted = total > 100;

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAllocations(
        Object.entries(percents).map(([categoryId, percent]) => ({
          categoryId: Number(categoryId),
          percent: percent || 0,
        })),
      );
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
        {categories.map((category) => {
          const percent = percents[category.id] ?? 0;
          return (
            <label
              key={category.id}
              className="flex items-baseline gap-3 text-[15px]"
            >
              <span
                aria-hidden
                className="self-center size-2.5 shrink-0"
                style={{ background: categoryColor(category.colorToken) }}
              />
              <span className="flex-1">{category.name}</span>
              <span className="figure text-[13px] text-ink-faint w-24 text-right">
                {percent > 0
                  ? formatCents(
                      Math.round((monthlyIncomeCents * percent) / 100),
                    )
                  : "—"}
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={percent || ""}
                placeholder="0"
                onChange={(e) => {
                  setSaved(false);
                  setPercents((prev) => ({
                    ...prev,
                    [category.id]: Number(e.target.value),
                  }));
                }}
                className="figure w-16 bg-transparent border-0 border-b border-rule-strong rounded-none py-0.5 text-right focus:outline-none focus:border-moss"
              />
              <span className="text-ink-faint">%</span>
            </label>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-baseline gap-6">
        <p className="text-[15px]">
          <span className={`figure ${overCommitted ? "text-oxblood" : ""}`}>
            {total.toFixed(1)}%
          </span>{" "}
          <span className="italic text-ink-faint">
            of income committed
            {total < 100 &&
              !overCommitted &&
              ` — ${(100 - total).toFixed(1)}% (${formatCents(
                Math.round((monthlyIncomeCents * (100 - total)) / 100),
              )}) unassigned`}
          </span>
        </p>
        <button
          onClick={handleSave}
          disabled={pending || overCommitted}
          className="bg-ink text-cream px-6 py-2 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Saving…" : "Save the plan"}
        </button>
        {saved && <span className="italic text-moss text-[15px]">Saved.</span>}
        {overCommitted && (
          <span className="italic text-oxblood text-[15px]">
            You&apos;ve promised more than 100% of the paycheck.
          </span>
        )}
        {error && <span className="italic text-oxblood text-[15px]">{error}</span>}
      </div>
    </div>
  );
}
