"use client";

import { useRef, useTransition } from "react";
import {
  addAccount,
  addCategory,
  deleteAccount,
  deleteCategory,
  deleteRule,
} from "@/lib/settings-actions";
import { categoryColor } from "@/components/charts";

const inputClass =
  "bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] focus:outline-none focus:border-moss";
const selectClass = `${inputClass} font-[family-name:var(--font-mono)] cursor-pointer`;
const buttonClass =
  "bg-ink text-cream px-6 py-2 label-caps !text-cream tracking-[0.2em] hover:bg-moss-deep transition-colors disabled:opacity-50 cursor-pointer";

export function AccountsSettings({
  accounts,
}: {
  accounts: { id: number; nickname: string; bank: string; kind: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section>
      <h2 className="label-caps rule-b pb-2 mb-4">Accounts</h2>
      <div className="mb-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="rule-b py-2.5 flex items-baseline gap-4 text-[15px]"
          >
            <span>{account.nickname}</span>
            <span className="label-caps">
              {account.bank} · {account.kind}
            </span>
            <button
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    `Delete "${account.nickname}"? All its transactions will be removed too.`,
                  )
                ) {
                  startTransition(() => deleteAccount(account.id));
                }
              }}
              className="ml-auto label-caps hover:text-oxblood cursor-pointer disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <form
        ref={formRef}
        action={(formData) =>
          startTransition(async () => {
            await addAccount(formData);
            formRef.current?.reset();
          })
        }
        className="flex flex-wrap items-end gap-x-6 gap-y-4"
      >
        <label className="block">
          <span className="label-caps block mb-1">Nickname</span>
          <input name="nickname" required placeholder="Scotiabank Visa" className={`${inputClass} italic w-44`} />
        </label>
        <label className="block">
          <span className="label-caps block mb-1">Bank</span>
          <select name="bank" className={selectClass}>
            <option value="wealthsimple">Wealthsimple</option>
            <option value="scotiabank">Scotiabank</option>
          </select>
        </label>
        <label className="block">
          <span className="label-caps block mb-1">Type</span>
          <select name="kind" className={selectClass}>
            <option value="debit">debit</option>
            <option value="credit">credit</option>
          </select>
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add
        </button>
      </form>
    </section>
  );
}

export function CategoriesSettings({
  categories,
}: {
  categories: { id: number; name: string; group: string; colorToken: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section>
      <h2 className="label-caps rule-b pb-2 mb-4">Categories</h2>
      <div className="mb-6 grid sm:grid-cols-2 gap-x-10">
        {categories.map((category) => (
          <div
            key={category.id}
            className="rule-b py-2 flex items-baseline gap-3 text-[15px]"
          >
            <span
              aria-hidden
              className="self-center size-2.5 shrink-0"
              style={{ background: categoryColor(category.colorToken) }}
            />
            <span>{category.name}</span>
            <span className="label-caps">{category.group}</span>
            <button
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    `Delete "${category.name}"? Its transactions become uncategorized.`,
                  )
                ) {
                  startTransition(() => deleteCategory(category.id));
                }
              }}
              className="ml-auto label-caps hover:text-oxblood cursor-pointer disabled:opacity-50"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <form
        ref={formRef}
        action={(formData) =>
          startTransition(async () => {
            await addCategory(formData);
            formRef.current?.reset();
          })
        }
        className="flex flex-wrap items-end gap-x-6 gap-y-4"
      >
        <label className="block">
          <span className="label-caps block mb-1">Name</span>
          <input name="name" required placeholder="Travel" className={`${inputClass} italic w-40`} />
        </label>
        <label className="block">
          <span className="label-caps block mb-1">Group</span>
          <select name="group" className={selectClass}>
            <option value="needs">needs</option>
            <option value="wants">wants</option>
            <option value="savings">savings</option>
          </select>
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add
        </button>
      </form>
    </section>
  );
}

export function RulesSettings({
  rules,
}: {
  rules: { id: number; pattern: string; category: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <h2 className="label-caps rule-b pb-2 mb-4">Filing rules</h2>
      {rules.length === 0 ? (
        <p className="italic text-ink-faint text-[15px]">
          None yet. Recategorize a transaction and choose &ldquo;always&rdquo;
          to create one.
        </p>
      ) : (
        <div>
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rule-b py-2.5 flex items-baseline gap-4 text-[15px]"
            >
              <span className="figure text-[14px]">“{rule.pattern}”</span>
              <span className="italic text-ink-faint">files under</span>
              <span>{rule.category}</span>
              <button
                disabled={pending}
                onClick={() => startTransition(() => deleteRule(rule.id))}
                className="ml-auto label-caps hover:text-oxblood cursor-pointer disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
