"use client";

import { useRef, useTransition } from "react";
import { addIncome, deleteIncome } from "@/lib/budget-actions";
import { formatCents } from "@/lib/budget";

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "monthly",
  semimonthly: "twice a month",
  biweekly: "every two weeks",
  weekly: "weekly",
};

export function IncomeSection({
  incomes,
  monthlyIncomeCents,
}: {
  incomes: {
    id: number;
    label: string;
    amountCents: number;
    frequency: string;
  }[];
  monthlyIncomeCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section>
      <div className="flex items-baseline justify-between rule-b pb-2 mb-6">
        <h2 className="label-caps">Income</h2>
        {monthlyIncomeCents > 0 && (
          <span className="text-[15px]">
            <span className="figure">{formatCents(monthlyIncomeCents)}</span>
            <span className="italic text-ink-faint"> a month, normalized</span>
          </span>
        )}
      </div>

      {incomes.length > 0 && (
        <div className="mb-6">
          {incomes.map((income) => (
            <div
              key={income.id}
              className="rule-b py-2.5 flex items-baseline gap-4 text-[15px]"
            >
              <span>{income.label}</span>
              <span className="italic text-ink-faint">
                {FREQUENCY_LABEL[income.frequency]}
              </span>
              <span className="figure ml-auto">
                {formatCents(income.amountCents)}
              </span>
              <button
                disabled={pending}
                onClick={() => startTransition(() => deleteIncome(income.id))}
                className="label-caps hover:text-oxblood cursor-pointer disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={(formData) => {
          startTransition(async () => {
            await addIncome(formData);
            formRef.current?.reset();
          });
        }}
        className="flex flex-wrap items-end gap-x-6 gap-y-4"
      >
        <label className="block">
          <span className="label-caps block mb-1">Source</span>
          <input
            name="label"
            required
            placeholder="Paycheck"
            className="bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] italic focus:outline-none focus:border-moss w-40"
          />
        </label>
        <label className="block">
          <span className="label-caps block mb-1">Amount ($, net)</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="2150.00"
            className="figure bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] focus:outline-none focus:border-moss w-32"
          />
        </label>
        <label className="block">
          <span className="label-caps block mb-1">Paid</span>
          <select
            name="frequency"
            defaultValue="biweekly"
            className="bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] font-[family-name:var(--font-mono)] focus:outline-none focus:border-moss cursor-pointer"
          >
            <option value="weekly">weekly</option>
            <option value="biweekly">every two weeks</option>
            <option value="semimonthly">twice a month</option>
            <option value="monthly">monthly</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-cream px-6 py-2 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer"
        >
          Add
        </button>
      </form>
    </section>
  );
}
