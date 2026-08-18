import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, categories, rules } from "@/db/schema";
import {
  AccountsSettings,
  CategoriesSettings,
  RulesSettings,
} from "@/components/settings-sections";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [userAccounts, userCategories, userRules] = await Promise.all([
    db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: (c, { asc }) => asc(c.sortOrder),
    }),
    db.query.rules.findMany({ where: eq(rules.userId, userId) }),
  ]);

  const categoryNames = new Map(userCategories.map((c) => [c.id, c.name]));
  const signupsOpen = process.env.ALLOW_SIGNUPS !== "false";

  return (
    <div className="max-w-3xl space-y-14">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight mb-2">
          Settings
        </h1>
        <p className="italic text-ink-soft">
          Accounts, categories, and the rules that file things automatically.
        </p>
      </div>

      <AccountsSettings
        accounts={userAccounts.map((a) => ({
          id: a.id,
          nickname: a.nickname,
          bank: a.bank,
          kind: a.kind,
        }))}
      />

      <CategoriesSettings
        categories={userCategories.map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group,
          colorToken: c.colorToken,
        }))}
      />

      <RulesSettings
        rules={userRules.map((r) => ({
          id: r.id,
          pattern: r.pattern,
          category: categoryNames.get(r.categoryId) ?? "—",
        }))}
      />

      <section>
        <h2 className="label-caps rule-b pb-2 mb-4">Sign-ups</h2>
        <p className="text-[15px]">
          {signupsOpen ? (
            <>
              Registration is <strong className="text-oxblood">open</strong>.
              Once your account exists, set{" "}
              <code className="figure text-[13px]">ALLOW_SIGNUPS=false</code> in
              the deployment&apos;s environment variables so the ledger stays
              yours alone.
            </>
          ) : (
            <>
              Registration is <strong className="text-moss">closed</strong> —
              no one else can create an account.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
