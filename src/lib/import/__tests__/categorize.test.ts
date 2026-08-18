import { describe, expect, it } from "vitest";
import { categorize } from "../categorize";
import type { Category, Rule } from "@/db/schema";

let nextId = 1;
function category(name: string): Category {
  return {
    id: nextId++,
    userId: 1,
    name,
    group: "wants",
    colorToken: "cat-1",
    sortOrder: 0,
  };
}

const CATEGORIES = [
  category("Groceries"),
  category("Dining & Coffee"),
  category("Income"),
  category("Transfers"),
];
const income = CATEGORIES[2];
const transfers = CATEGORIES[3];

describe("categorize", () => {
  it("files payroll AFT_IN deposits as income, not transfers", () => {
    const result = categorize(
      "PAYROLL DEPOSIT ACME CORP — AFT_IN",
      "Payroll Deposit Acme Corp",
      215000,
      [],
      CATEGORIES,
    );
    expect(result.categoryId).toBe(income.id);
    expect(result.isTransfer).toBe(false);
  });

  it("marks Scotia TRFOUT inter-account transfers as transfers", () => {
    const result = categorize(
      "Transfer out — TRFOUTTF",
      "Transfer Out",
      -259630,
      [],
      CATEGORIES,
    );
    expect(result.isTransfer).toBe(true);
    expect(result.categoryId).toBe(transfers.id);
  });

  it("marks credit card payments as transfers", () => {
    const result = categorize(
      "PAYMENT - THANK YOU",
      "Payment - Thank You",
      -40000,
      [],
      CATEGORIES,
    );
    expect(result.categoryId).toBe(transfers.id);
    expect(result.isTransfer).toBe(true);
  });

  it("prefers user rules over everything", () => {
    const rule: Rule = {
      id: 1,
      userId: 1,
      pattern: "starbucks",
      categoryId: CATEGORIES[0].id, // deliberately "wrong" — user's choice wins
      priority: 0,
      createdAt: new Date(),
    };
    const result = categorize(
      "STARBUCKS #4521",
      "Starbucks",
      -645,
      [rule],
      CATEGORIES,
    );
    expect(result.categoryId).toBe(CATEGORIES[0].id);
  });

  it("falls back to builtin keywords, then uncategorized", () => {
    expect(
      categorize("TIM HORTONS #2210", "Tim Hortons", -300, [], CATEGORIES)
        .categoryId,
    ).toBe(CATEGORIES[1].id);
    expect(
      categorize("MYSTERY SHOP 42", "Mystery Shop", -300, [], CATEGORIES)
        .categoryId,
    ).toBeNull();
  });
});
