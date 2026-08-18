import type { ParseResult, RawTxn, StatementParser } from "../types";
import { parseAmountToCents, parseStatementDate, resolveYearlessDate } from "../dates";
import { findStatementPeriod } from "./pdf-lines";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const AMOUNT = "\\$?[\\d,]+\\.\\d{2}";

// "Apr 29 Payroll dep. 2,073.84 2,173.84" → date, description, amount, balance
const TXN_LINE = new RegExp(
  `^(${MONTH})\\.?\\s+(\\d{1,2})\\s+(.+?)\\s+(${AMOUNT})\\s+(${AMOUNT})$`,
  "i",
);
const SKIP_LINE =
  /opening balance|closing balance|minus total|plus total|amounts\s|date transactions|page \d|account summary|statement period/i;
// Footer codes, addresses, phone lines — never part of a description.
const JUNK_LINE =
  /^[*|]|_|www\.|call 1|account number|^\d{5,}\s*$|questions\?|^mr\s|^mrs\s|^ms\s/i;

/**
 * Scotiabank chequing/savings PDF statement. The table has separate
 * "withdrawn" and "deposited" columns that collapse into one number after
 * text extraction, so the sign of each transaction is inferred from the
 * running balance column instead. Wrapped description lines (payee details)
 * are appended to the transaction above them.
 */
export const scotiabankPdf: StatementParser = {
  id: "scotiabank-pdf",
  label: "Scotiabank PDF statement",
  format: "pdf",
  bank: "scotiabank",

  detect(text) {
    return /scotiabank|bank of nova scotia|scotia/i.test(text);
  },

  parse(text): ParseResult {
    // Period: "Opening Balance on April 27, 2026 … Closing Balance on April 30, 2026"
    const openMatch = text.match(
      /opening balance on ([A-Za-z]+ \d{1,2},? \d{4})\s*\$?([\d,]+\.\d{2})/i,
    );
    const closeMatch = text.match(
      /closing balance on ([A-Za-z]+ \d{1,2},? \d{4})/i,
    );
    const generic = findStatementPeriod(text);
    const periodStart =
      (openMatch && parseStatementDate(openMatch[1])) ?? generic?.start ?? null;
    const periodEnd =
      (closeMatch && parseStatementDate(closeMatch[1])) ?? generic?.end ?? null;

    let prevBalance =
      openMatch !== null ? parseAmountToCents(openMatch[2]) : null;

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s{2,}/g, " ").trim())
      .filter(Boolean);

    const transactions: RawTxn[] = [];
    const skipped: string[] = [];
    let confidence: "high" | "low" = "high";
    let last: RawTxn | null = null;
    let continuations = 0;

    const startsWithDate = new RegExp(`^(${MONTH})\\.?\\s+\\d{1,2}\\b`, "i");

    for (const line of lines) {
      if (SKIP_LINE.test(line)) {
        last = null;
        continue;
      }
      if (JUNK_LINE.test(line)) continue;

      const m = line.match(TXN_LINE);
      if (!m) {
        // Wrapped payee detail ("Maple Widgets Payroll Inc.") — append to
        // the transaction directly above. At most two lines, never anything
        // that looks like a dated row or carries amounts (partial table rows
        // from page breaks would otherwise get glued on).
        if (
          last &&
          continuations < 2 &&
          /[A-Za-z]{3,}/.test(line) &&
          line.length < 80 &&
          !startsWithDate.test(line) &&
          !/\d+\.\d{2}/.test(line)
        ) {
          last.description = `${last.description} — ${line.replace(/^\d+\s+/, "")}`;
          continuations += 1;
        }
        continue;
      }
      continuations = 0;

      const [, monthName, day, description, amountRaw, balanceRaw] = m;
      const amount = parseAmountToCents(amountRaw);
      const balance = parseAmountToCents(balanceRaw);
      const date =
        periodStart && periodEnd
          ? resolveYearlessDate(monthName, day, periodStart, periodEnd)
          : null;

      if (date === null || amount === null || balance === null) {
        skipped.push(line);
        continue;
      }
      if (amount === 0) continue; // placeholder rows ("Deposit 0.00 0.00")

      // Direction from the running balance.
      let amountCents: number;
      if (prevBalance !== null && prevBalance + amount === balance) {
        amountCents = amount; // deposit
      } else if (prevBalance !== null && prevBalance - amount === balance) {
        amountCents = -amount; // withdrawal
      } else {
        amountCents = -amount; // unknown chain — assume spending, flag it
        confidence = "low";
        skipped.push(`(direction guessed) ${line}`);
      }
      prevBalance = balance;

      last = { date, description: description.trim(), amountCents };
      transactions.push(last);
    }

    return {
      transactions,
      skipped,
      confidence: transactions.length >= 1 ? confidence : "low",
    };
  },
};
