import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const bankEnum = pgEnum("bank", ["wealthsimple", "scotiabank"]);
export const accountKindEnum = pgEnum("account_kind", ["debit", "credit"]);
export const categoryGroupEnum = pgEnum("category_group", [
  "needs",
  "wants",
  "savings",
  "income",
  "transfer",
]);
export const incomeFrequencyEnum = pgEnum("income_frequency", [
  "monthly",
  "semimonthly",
  "biweekly",
  "weekly",
]);
export const importFormatEnum = pgEnum("import_format", ["csv", "pdf"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bank: bankEnum("bank").notNull(),
  kind: accountKindEnum("kind").notNull(),
  nickname: text("nickname").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  group: categoryGroupEnum("group").notNull().default("wants"),
  colorToken: text("color_token").notNull().default("cat-12"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  format: importFormatEnum("format").notNull(),
  rowsAdded: integer("rows_added").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // Stored as plain calendar date; parsed/formatted as YYYY-MM-DD strings only.
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    merchant: text("merchant").notNull(),
    // Negative = money out, positive = money in, regardless of source bank.
    amountCents: integer("amount_cents").notNull(),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    isTransfer: boolean("is_transfer").notNull().default(false),
    importId: integer("import_id").references(() => imports.id, {
      onDelete: "set null",
    }),
    dedupeHash: text("dedupe_hash").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("txn_account_dedupe_idx").on(t.accountId, t.dedupeHash),
    index("txn_date_idx").on(t.date),
    index("txn_category_idx").on(t.categoryId),
  ],
);

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Case-insensitive substring matched against the raw description + merchant.
  pattern: text("pattern").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  frequency: incomeFrequencyEnum("frequency").notNull().default("biweekly"),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const allocations = pgTable(
  "allocations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("alloc_user_category_idx").on(t.userId, t.categoryId)],
);

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type Allocation = typeof allocations.$inferSelect;
export type ImportRecord = typeof imports.$inferSelect;
