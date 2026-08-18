import { describe, expect, it } from "vitest";
import { wealthsimpleCsv } from "../parsers/wealthsimple-csv";
import { wealthsimpleCreditCsv } from "../parsers/wealthsimple-credit-csv";
import { scotiabankCsv } from "../parsers/scotiabank-csv";
import { scotiabankPdf } from "../parsers/scotiabank-pdf";
import { parseStatementLines } from "../parsers/pdf-lines";
import { detectParser } from "../registry";
import { withDedupeHashes, cleanMerchant } from "../normalize";
import { parseAmountToCents, parseStatementDate } from "../dates";
import {
  SCOTIABANK_CSV,
  SCOTIA_PDF_TEXT,
  STATEMENT_PDF_TEXT,
  WEALTHSIMPLE_CREDIT_CSV,
  WEALTHSIMPLE_CSV,
} from "./fixtures";

describe("dates & amounts", () => {
  it("parses bank date formats without timezone drift", () => {
    expect(parseStatementDate("2026-07-02")).toBe("2026-07-02");
    expect(parseStatementDate("7/02/2026")).toBe("2026-07-02");
    expect(parseStatementDate("Jul 2, 2026")).toBe("2026-07-02");
    expect(parseStatementDate("2 July 2026")).toBe("2026-07-02");
    expect(parseStatementDate("nonsense")).toBeNull();
  });

  it("parses amount notations to cents", () => {
    expect(parseAmountToCents("-6.45")).toBe(-645);
    expect(parseAmountToCents("$2,150.00")).toBe(215000);
    expect(parseAmountToCents("(84.12)")).toBe(-8412);
    expect(parseAmountToCents("")).toBeNull();
  });
});

describe("wealthsimple csv", () => {
  it("detects and parses all rows", () => {
    expect(wealthsimpleCsv.detect(WEALTHSIMPLE_CSV)).toBe(true);
    const result = wealthsimpleCsv.parse(WEALTHSIMPLE_CSV);
    expect(result.transactions).toHaveLength(6);
    expect(result.skipped).toHaveLength(0);
    expect(result.transactions[0]).toMatchObject({
      date: "2026-07-02",
      amountCents: -645,
    });
    expect(result.transactions[3].amountCents).toBe(215000);
  });
});

describe("scotiabank csv (headerless)", () => {
  it("detects and parses all rows", () => {
    expect(scotiabankCsv.detect(SCOTIABANK_CSV)).toBe(true);
    const result = scotiabankCsv.parse(SCOTIABANK_CSV);
    expect(result.transactions).toHaveLength(5);
    expect(result.transactions[0]).toMatchObject({
      date: "2026-07-02",
      amountCents: -4280,
    });
    expect(result.transactions[0].description).toContain("METRO");
  });
});

describe("wealthsimple credit csv", () => {
  it("detects, flips card-convention signs, keeps refund triples", () => {
    expect(wealthsimpleCreditCsv.detect(WEALTHSIMPLE_CREDIT_CSV)).toBe(true);
    const result = wealthsimpleCreditCsv.parse(WEALTHSIMPLE_CREDIT_CSV);
    expect(result.transactions).toHaveLength(7);
    // Purchase 14.0 → money out
    expect(result.transactions[0]).toMatchObject({
      date: "2026-07-04",
      amountCents: -1400,
    });
    // Payment -1234.56 → money in
    expect(result.transactions[2].amountCents).toBe(123456);
    // Refund triple nets to +14.92 (money back)
    const refundNet = result.transactions
      .filter((t) => t.description.includes("Refund"))
      .reduce((s, t) => s + t.amountCents, 0);
    expect(refundNet).toBe(1492);
    // Monthly fee has empty details → type used as description
    expect(result.transactions[6].description).toBe("Monthly fee");
    expect(result.transactions[6].amountCents).toBe(-22000);
  });
});

describe("scotiabank pdf", () => {
  it("infers direction from the running balance and joins wrapped payee lines", () => {
    expect(scotiabankPdf.detect(SCOTIA_PDF_TEXT)).toBe(true);
    const result = scotiabankPdf.parse(SCOTIA_PDF_TEXT);
    expect(result.confidence).toBe("high");
    expect(result.transactions).toHaveLength(3); // zero-amount row dropped
    // Deposit 100 (100 → 200)
    expect(result.transactions[0]).toMatchObject({
      date: "2026-04-27",
      amountCents: 10000,
    });
    expect(result.transactions[0].description).toContain(
      "Free Interac E-Transfer",
    );
    // Withdrawal 50 (200 → 150)
    expect(result.transactions[1].amountCents).toBe(-5000);
    // Payroll deposit with wrapped employer name (150 → 2,223.84)
    expect(result.transactions[2]).toMatchObject({
      date: "2026-04-29",
      amountCents: 150000,
    });
    expect(result.transactions[2].description).toContain("Maple Widgets");
  });
});

describe("pdf statement lines", () => {
  it("parses lines with yearless dates against the statement period", () => {
    const result = parseStatementLines(STATEMENT_PDF_TEXT);
    expect(result.transactions).toHaveLength(4);
    expect(result.confidence).toBe("high");
    expect(result.transactions[0]).toMatchObject({
      date: "2026-07-03",
      amountCents: 3250,
    });
    // Trailing minus = credit
    expect(result.transactions[2].amountCents).toBe(-40000);
  });
});

describe("registry detection", () => {
  it("routes csv and pdf content to the right parser", () => {
    expect(detectParser(WEALTHSIMPLE_CSV, "csv")?.id).toBe("wealthsimple-csv");
    expect(detectParser(SCOTIABANK_CSV, "csv")?.id).toBe("scotiabank-csv");
    expect(detectParser(STATEMENT_PDF_TEXT, "pdf")?.id).toBe(
      "wealthsimple-pdf",
    );
  });

  it("falls back to the account's bank when detection fails", () => {
    expect(detectParser("garbage", "pdf", "scotiabank")?.id).toBe(
      "scotiabank-pdf",
    );
  });
});

describe("dedupe hashing", () => {
  it("keeps identical same-day rows within one file, collides across re-imports", () => {
    const parsed = wealthsimpleCsv.parse(WEALTHSIMPLE_CSV).transactions;
    const first = withDedupeHashes(7, parsed);
    const again = withDedupeHashes(7, parsed);

    // Two identical Starbucks rows get distinct hashes within the file...
    expect(first[0].dedupeHash).not.toBe(first[1].dedupeHash);
    // ...but a re-import of the same file produces the same hashes.
    expect(new Set(first.map((t) => t.dedupeHash))).toEqual(
      new Set(again.map((t) => t.dedupeHash)),
    );
    // Different account → different hashes.
    const otherAccount = withDedupeHashes(8, parsed);
    expect(otherAccount[0].dedupeHash).not.toBe(first[0].dedupeHash);
  });
});

describe("merchant cleanup", () => {
  it("strips bank noise and title-cases shouting", () => {
    expect(cleanMerchant("STARBUCKS #4521 TORONTO ON")).toBe(
      "Starbucks Toronto",
    );
    expect(cleanMerchant("POS Purchase - METRO #567 TORONTO ON")).toBe(
      "Metro Toronto",
    );
    expect(cleanMerchant("STARBUCKS #4521 TORONTO ON — SPEND")).toBe(
      "Starbucks Toronto",
    );
  });
});
