import { desc, eq, inArray } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { accounts, categories, imports } from "@/db/schema";
import { ImportWizard } from "@/components/import-wizard";
import { ImportHistory } from "@/components/import-history";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const userId = await requireUserId();
  const [userAccounts, userCategories] = await Promise.all([
    db.query.accounts.findMany({ where: eq(accounts.userId, userId) }),
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: (c, { asc }) => asc(c.sortOrder),
    }),
  ]);

  const history =
    userAccounts.length > 0
      ? await db.query.imports.findMany({
          where: inArray(
            imports.accountId,
            userAccounts.map((a) => a.id),
          ),
          orderBy: desc(imports.createdAt),
          limit: 20,
        })
      : [];

  const accountNames = new Map(userAccounts.map((a) => [a.id, a.nickname]));

  return (
    <div className="max-w-4xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight mb-2">
        Import a statement
      </h1>
      <p className="italic text-ink-soft mb-10">
        CSV exports are the most reliable; PDF statements work too. Re-uploading
        an overlapping period is safe — duplicates are skipped.
      </p>

      <ImportWizard accounts={userAccounts} categories={userCategories} />

      {history.length > 0 && (
        <section className="mt-16">
          <h2 className="label-caps mb-4">Past imports</h2>
          <ImportHistory
            history={history.map((h) => ({
              id: h.id,
              filename: h.filename,
              format: h.format,
              rowsAdded: h.rowsAdded,
              rowsSkipped: h.rowsSkipped,
              account: accountNames.get(h.accountId) ?? "—",
              date: h.createdAt.toISOString().slice(0, 10),
            }))}
          />
        </section>
      )}
    </div>
  );
}
