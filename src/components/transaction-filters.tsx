"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Account, Category } from "@/db/schema";

export function TransactionFilters({
  accounts,
  categories,
  current,
}: {
  accounts: Account[];
  categories: Category[];
  current: { month?: string; account?: string; category?: string; q?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] font-[family-name:var(--font-mono)] focus:outline-none focus:border-moss cursor-pointer";

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mb-8">
      <label className="block">
        <span className="label-caps block mb-1">Month</span>
        <input
          type="month"
          defaultValue={current.month ?? ""}
          onChange={(e) => setParam("month", e.target.value)}
          className={selectClass}
        />
      </label>
      <label className="block">
        <span className="label-caps block mb-1">Account</span>
        <select
          defaultValue={current.account ?? ""}
          onChange={(e) => setParam("account", e.target.value)}
          className={selectClass}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nickname}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label-caps block mb-1">Category</span>
        <select
          defaultValue={current.category ?? ""}
          onChange={(e) => setParam("category", e.target.value)}
          className={selectClass}
        >
          <option value="">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block flex-1 min-w-48">
        <span className="label-caps block mb-1">Search</span>
        <input
          type="search"
          defaultValue={current.q ?? ""}
          placeholder="merchant or description…"
          onChange={(e) => {
            const value = e.target.value;
            // Light debounce
            setTimeout(() => setParam("q", value), 300);
          }}
          className="w-full bg-transparent border-0 border-b border-rule-strong rounded-none py-1 text-[15px] italic focus:outline-none focus:border-moss"
        />
      </label>
    </div>
  );
}
