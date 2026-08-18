import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/lib/auth-actions";
import { NavLinks } from "@/components/nav-links";
import { ChatBubble } from "@/components/chat-bubble";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "you";

  return (
    <div className="min-h-dvh max-w-6xl mx-auto px-6 md:px-10">
      <header className="pt-8 pb-0">
        <div className="flex items-baseline justify-between">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-display)] text-3xl tracking-tight"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
          >
            Ledger
          </Link>
          <div className="flex items-baseline gap-6">
            <span className="hidden sm:inline italic text-ink-faint text-[15px]">
              kept by {firstName}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="label-caps hover:text-oxblood transition-colors cursor-pointer"
              >
                Close
              </button>
            </form>
          </div>
        </div>
        <nav className="mt-6 double-rule">
          <NavLinks />
        </nav>
      </header>
      <main className="py-10">{children}</main>
      <ChatBubble />
      <footer className="rule-t py-6 mb-4 flex justify-between items-baseline">
        <span className="label-caps">Ledger</span>
        <span className="italic text-ink-faint text-sm">
          money, accounted for.
        </span>
      </footer>
    </div>
  );
}
