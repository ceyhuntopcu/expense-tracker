"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/merchants", label: "Merchants" },
  { href: "/recurring", label: "Recurring" },
  { href: "/import", label: "Import" },
  { href: "/budget", label: "Budget" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex gap-0 -mx-3 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`label-caps px-3 py-3 whitespace-nowrap transition-colors ${
              active
                ? "!text-ink border-b-2 border-ink -mb-px"
                : "hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
