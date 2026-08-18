import type { ParseResult, RawTxn } from "../types";
import {
  parseAmountToCents,
  parseStatementDate,
  resolveYearlessDate,
} from "../dates";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";

/** Find the statement period ("July 1, 2026 to July 31, 2026" etc.). */
export function findStatementPeriod(
  text: string,
): { start: string; end: string } | null {
  const dateToken = `(${MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`;
  const m = text.match(
    new RegExp(`${dateToken}\\s*(?:to|through|-|–)\\s*${dateToken}`, "i"),
  );
  if (!m) return null;
  const start = parseStatementDate(m[1]);
  const end = parseStatementDate(m[2]);
  return start && end ? { start, end } : null;
}

const SKIP_LINE =
  /balance forward|opening balance|closing balance|previous balance|new balance|total|minimum payment|payment due|statement|page \d/i;

/**
 * Parse "MMM DD [MMM DD] description ... amount [balance]" lines — the shape
 * both banks' statement tables reduce to once PDF text is extracted.
 */
export function parseStatementLines(text: string): ParseResult {
  const period = findStatementPeriod(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s{2,}/g, "  ").trim())
    .filter(Boolean);

  const transactions: RawTxn[] = [];
  const skipped: string[] = [];

  const lineRe = new RegExp(
    // date (may repeat for posting date), description, 1–2 trailing amounts
    `^(${MONTH})\\.?\\s+(\\d{1,2})\\s+(?:(?:${MONTH})\\.?\\s+\\d{1,2}\\s+)?(.+?)\\s+(-?\\$?[\\d,]+\\.\\d{2}-?)(?:\\s+-?\\$?[\\d,]+\\.\\d{2}-?)?$`,
    "i",
  );

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    const m = line.match(lineRe);
    if (!m) continue;

    const [, monthName, day, description, rawAmount] = m;
    const date = period
      ? resolveYearlessDate(monthName, day, period.start, period.end)
      : null;

    // Trailing minus ("12.34-") is a credit marker on some statements.
    const trailingMinus = rawAmount.endsWith("-");
    const amountCents = parseAmountToCents(
      trailingMinus ? `-${rawAmount.slice(0, -1)}` : rawAmount,
    );

    if (!date || amountCents === null || !description.trim()) {
      skipped.push(line);
      continue;
    }
    transactions.push({ date, description: description.trim(), amountCents });
  }

  return {
    transactions,
    skipped,
    // PDFs are brittle: anything short of a healthy row count is suspect.
    confidence: transactions.length >= 3 ? "high" : "low",
  };
}
