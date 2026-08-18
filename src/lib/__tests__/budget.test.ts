import { describe, expect, it } from "vitest";
import {
  allocationBudgetCents,
  formatCents,
  monthlyIncomeCents,
  monthOf,
  monthRange,
  shiftMonth,
} from "../budget";
import type { Income } from "@/db/schema";

function income(amountCents: number, frequency: Income["frequency"]): Income {
  return {
    id: 1,
    userId: 1,
    label: "job",
    amountCents,
    frequency,
    effectiveFrom: "2026-01-01",
    createdAt: new Date(),
  };
}

describe("monthly income normalization", () => {
  it("normalizes each pay frequency to monthly", () => {
    expect(monthlyIncomeCents([income(300000, "monthly")])).toBe(300000);
    expect(monthlyIncomeCents([income(150000, "semimonthly")])).toBe(300000);
    expect(monthlyIncomeCents([income(120000, "biweekly")])).toBe(260000);
    expect(monthlyIncomeCents([income(60000, "weekly")])).toBe(260000);
  });

  it("sums multiple sources", () => {
    expect(
      monthlyIncomeCents([income(300000, "monthly"), income(60000, "weekly")]),
    ).toBe(560000);
  });
});

describe("allocation math", () => {
  it("computes percent of monthly income in cents", () => {
    expect(allocationBudgetCents(560000, "30")).toBe(168000);
    expect(allocationBudgetCents(560000, "12.5")).toBe(70000);
  });
});

describe("formatting & month helpers", () => {
  it("formats cents as CAD-style strings", () => {
    expect(formatCents(168000)).toBe("$1,680.00");
    expect(formatCents(-645)).toBe("−$6.45");
  });

  it("builds valid date bounds for short months", () => {
    // June has 30 days — a "-31" literal crashes Postgres.
    expect(monthRange("2026-06")).toEqual({
      start: "2026-06-01",
      endExclusive: "2026-07-01",
    });
    expect(monthRange("2026-12").endExclusive).toBe("2027-01-01");
    expect(monthRange("2026-02").endExclusive).toBe("2026-03-01");
  });

  it("extracts and shifts months", () => {
    expect(monthOf("2026-08-13")).toBe("2026-08");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-08", -6)).toBe("2026-02");
  });
});
