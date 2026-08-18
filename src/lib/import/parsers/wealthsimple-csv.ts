import Papa from "papaparse";
import type { ParseResult, RawTxn, StatementParser } from "../types";
import { parseAmountToCents, parseStatementDate } from "../dates";

/**
 * Wealthsimple account CSV export. Recent exports use headers like
 * `date,transaction,description,amount,balance`; be lenient about naming
 * so minor format drift doesn't break imports.
 */
export const wealthsimpleCsv: StatementParser = {
  id: "wealthsimple-csv",
  label: "Wealthsimple CSV",
  format: "csv",
  bank: "wealthsimple",

  detect(text) {
    const firstLine = text.slice(0, 400).split(/\r?\n/)[0]?.toLowerCase() ?? "";
    return (
      firstLine.includes("date") &&
      firstLine.includes("amount") &&
      (firstLine.includes("description") || firstLine.includes("transaction"))
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
        row["date"] ?? row["transaction date"] ?? row["process date"] ?? "",
      );
      const amountCents = parseAmountToCents(row["amount"] ?? "");
      const description = [row["description"], row["transaction"]]
        .filter(Boolean)
        .join(" — ")
        .trim();

      if (date === null || amountCents === null || !description) {
        skipped.push(Object.values(row).join(", "));
        continue;
      }
      transactions.push({ date, description, amountCents });
    }

    return {
      transactions,
      skipped,
      confidence: transactions.length > 0 ? "high" : "low",
    };
  },
};
