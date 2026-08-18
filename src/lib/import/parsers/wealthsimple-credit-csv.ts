import Papa from "papaparse";
import type { ParseResult, RawTxn, StatementParser } from "../types";
import { parseAmountToCents, parseStatementDate } from "../dates";

/**
 * Wealthsimple CREDIT CARD statement CSV:
 * `transaction_date, post_date, type, details, amount, currency`.
 * Card convention: purchases positive, payments negative — the exact opposite
 * of our ledger convention, so every amount is flipped. Refunds arrive as
 * initiated/settled row triples that net out correctly when all are kept.
 */
export const wealthsimpleCreditCsv: StatementParser = {
  id: "wealthsimple-credit-csv",
  label: "Wealthsimple credit card CSV",
  format: "csv",
  bank: "wealthsimple",

  detect(text) {
    const firstLine = text.slice(0, 400).split(/\r?\n/)[0]?.toLowerCase() ?? "";
    return (
      firstLine.includes("transaction_date") &&
      firstLine.includes("details") &&
      firstLine.includes("amount")
    );
  },

  parse(text): ParseResult {
    const { data } = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const transactions: RawTxn[] = [];
    const skipped: string[] = [];

    for (const row of data) {
      const date = parseStatementDate(
        row["transaction_date"] ?? row["post_date"] ?? "",
      );
      const raw = parseAmountToCents(row["amount"] ?? "");
      const type = (row["type"] ?? "").trim();
      const details = (row["details"] ?? "").trim();
      const description = details
        ? type
          ? `${details} — ${type}`
          : details
        : type;

      if (date === null || raw === null || !description) {
        skipped.push(Object.values(row).join(", "));
        continue;
      }
      transactions.push({ date, description, amountCents: -raw });
    }

    return {
      transactions,
      skipped,
      confidence: transactions.length > 0 ? "high" : "low",
    };
  },
};
