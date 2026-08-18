import Papa from "papaparse";
import type { ParseResult, RawTxn, StatementParser } from "../types";
import { parseAmountToCents, parseStatementDate } from "../dates";

/**
 * Scotiabank online-banking CSV download. Classic chequing exports are
 * HEADERLESS: `M/D/YYYY,amount,,type,description`. Newer exports may carry
 * headers — both are handled.
 */
export const scotiabankCsv: StatementParser = {
  id: "scotiabank-csv",
  label: "Scotiabank CSV",
  format: "csv",
  bank: "scotiabank",

  detect(text) {
    const firstLine = text.slice(0, 400).split(/\r?\n/)[0] ?? "";
    const firstField = firstLine.split(",")[0]?.replace(/"/g, "").trim() ?? "";
    // Headerless: first cell of the first row is already a date.
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(firstField)) return true;
    // Headered: require Scotia-specific column names, not just date+amount
    // (which would also match other banks' exports).
    const lower = firstLine.toLowerCase();
    return (
      lower.includes("date") &&
      lower.includes("amount") &&
      (lower.includes("sub-description") ||
        lower.includes("type of transaction"))
    );
  },

  parse(text): ParseResult {
    const trimmed = text.trim();
    const firstField =
      trimmed.split(/\r?\n/)[0]?.split(",")[0]?.replace(/"/g, "").trim() ?? "";
    const headerless = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(firstField);

    const transactions: RawTxn[] = [];
    const skipped: string[] = [];

    if (headerless) {
      const { data } = Papa.parse<string[]>(trimmed, {
        skipEmptyLines: true,
      });
      for (const row of data) {
        const date = parseStatementDate(row[0] ?? "");
        const amountCents = parseAmountToCents(row[1] ?? "");
        const description = row
          .slice(2)
          .map((c) => c?.trim())
          .filter(Boolean)
          .join(" — ");
        if (date === null || amountCents === null || !description) {
          skipped.push(row.join(", "));
          continue;
        }
        transactions.push({ date, description, amountCents });
      }
    } else {
      const { data } = Papa.parse<Record<string, string>>(trimmed, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      for (const row of data) {
        const date = parseStatementDate(row["date"] ?? "");
        const amountCents = parseAmountToCents(row["amount"] ?? "");
        const description = [
          row["description"],
          row["sub-description"] ?? row["subdescription"] ?? row["memo"],
          row["type of transaction"] ?? row["type"],
        ]
          .filter(Boolean)
          .join(" — ")
          .trim();
        if (date === null || amountCents === null || !description) {
          skipped.push(Object.values(row).join(", "));
          continue;
        }
        transactions.push({ date, description, amountCents });
      }
    }

    return {
      transactions,
      skipped,
      confidence: transactions.length > 0 ? "high" : "low",
    };
  },
};
