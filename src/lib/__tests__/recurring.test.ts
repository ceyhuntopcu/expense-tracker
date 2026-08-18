import { describe, expect, it } from "vitest";
import { detectRecurring } from "../recurring";

function txn(
  date: string,
  merchant: string,
  amountCents: number,
  overrides: Partial<{ categoryId: number | null; isTransfer: boolean }> = {},
) {
  return {
    date,
    merchant,
    amountCents,
    categoryId: overrides.categoryId ?? null,
    isTransfer: overrides.isTransfer ?? false,
  };
}

describe("detectRecurring", () => {
  it("finds steady monthly charges and annualizes them", () => {
    const txns = [
      txn("2026-06-05", "Netflix.Com", -1899),
      txn("2026-07-05", "Netflix.Com", -1899),
      txn("2026-08-05", "Netflix.Com", -1899),
      txn("2026-06-01", "Rent Payment", -95000),
      txn("2026-07-01", "Rent Payment", -95000),
      txn("2026-08-01", "Rent Payment", -95000),
    ];
    const result = detectRecurring(txns, 6);
    expect(result.map((r) => r.merchant)).toEqual([
      "Rent Payment",
      "Netflix.Com",
    ]);
    expect(result[1].typicalCents).toBe(1899);
    expect(result[1].annualizedCents).toBe(22788);
    expect(result[0].monthsSeen).toBe(3);
  });

  it("ignores frequent variable spending like groceries", () => {
    const txns = [
      txn("2026-06-02", "Metro", -4211),
      txn("2026-06-09", "Metro", -6350),
      txn("2026-06-16", "Metro", -2799),
      txn("2026-06-23", "Metro", -5125),
      txn("2026-07-03", "Metro", -3980),
      txn("2026-07-11", "Metro", -7205),
      txn("2026-07-19", "Metro", -4462),
      txn("2026-08-01", "Metro", -5834),
      txn("2026-08-09", "Metro", -3117),
    ];
    expect(detectRecurring(txns, 6)).toHaveLength(0);
  });

  it("rejects merchants whose amounts swing too much", () => {
    const txns = [
      txn("2026-06-14", "Amazon", -1500),
      txn("2026-07-14", "Amazon", -8900),
      txn("2026-08-14", "Amazon", -400),
    ];
    expect(detectRecurring(txns, 6)).toHaveLength(0);
  });

  it("ignores transfers, income, and one-offs", () => {
    const txns = [
      txn("2026-06-01", "Payroll", 215000),
      txn("2026-07-01", "Payroll", 215000),
      txn("2026-06-08", "John Doe", -12000, { isTransfer: true }),
      txn("2026-07-08", "John Doe", -12000, { isTransfer: true }),
      txn("2026-08-08", "John Doe", -12000, { isTransfer: true }),
      txn("2026-08-03", "Ticketmaster", -15000),
    ];
    expect(detectRecurring(txns, 6)).toHaveLength(0);
  });
});
