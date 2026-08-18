import type { StatementParser } from "./types";
import { wealthsimpleCsv } from "./parsers/wealthsimple-csv";
import { wealthsimpleCreditCsv } from "./parsers/wealthsimple-credit-csv";
import { scotiabankCsv } from "./parsers/scotiabank-csv";
import { wealthsimplePdf } from "./parsers/wealthsimple-pdf";
import { scotiabankPdf } from "./parsers/scotiabank-pdf";

/** Order matters: more specific signatures first within each format. */
export const PARSERS: StatementParser[] = [
  wealthsimpleCreditCsv,
  scotiabankCsv,
  wealthsimpleCsv,
  scotiabankPdf,
  wealthsimplePdf,
];

export function detectParser(
  text: string,
  format: "csv" | "pdf",
  preferredBank?: "wealthsimple" | "scotiabank",
): StatementParser | null {
  const candidates = PARSERS.filter((p) => p.format === format);
  if (preferredBank) {
    const preferred = candidates.find(
      (p) => p.bank === preferredBank && p.detect(text),
    );
    if (preferred) return preferred;
    // The account's bank wins even when detection fails — the user picked it.
    const fallback = candidates.find((p) => p.bank === preferredBank);
    if (fallback) return fallback;
  }
  return candidates.find((p) => p.detect(text)) ?? null;
}
