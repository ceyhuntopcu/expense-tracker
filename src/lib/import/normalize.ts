import { createHash } from "node:crypto";
import type { RawTxn } from "./types";

const NOISE_PATTERNS: RegExp[] = [
  // Transaction-type suffixes appended when parsers join description columns.
  /\s*[—–-]+\s*(spend|aft_?in|aft_?out|e-?transfer|pos purchase|bill payment|deposit|transfer|withdrawal|payment)\s*$/i,
  /^(pos purchase|pos|point of sale( -)? interac( retail)? purchase)\s*-?\s*/i,
  /^(interac|visa debit|contactless|opos|apos)\s*-?\s*/i,
  /^(e-?transfer|etfr|aft|eft)\s+(to|from)?\s*/i,
  /\b\d{3,}\b/g, // store / reference numbers
  /\s+(on|le)\s+\d{1,2}[-/]\d{1,2}.*$/i,
  /[#*]+\w*/g,
];

/** "STARBUCKS #1234 TORONTO ON" → "Starbucks Toronto" (best effort). */
export function cleanMerchant(description: string): string {
  let s = description.trim();
  for (const p of NOISE_PATTERNS) s = s.replace(p, " ");
  s = s
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\s+(ON|QC|BC|AB|SK|MB|NS|NB|NL|PE|YT|NT|NU|CANADA|CAN|CA)$/i, "")
    .trim();
  if (!s) s = description.trim();
  // Title-case ALL-CAPS bank shouting; leave mixed case alone.
  if (s === s.toUpperCase()) {
    s = s
      .toLowerCase()
      .replace(/(^|[\s\-/&.])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
  }
  return s;
}

function normalizeDescription(description: string): string {
  return description.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Stable identity for a transaction within an account. `occurrenceIndex`
 * distinguishes genuinely repeated rows in the SAME file (two identical
 * coffees on one day) while making re-imports of overlapping statements
 * collide with existing rows.
 */
export function dedupeHash(
  accountId: number,
  txn: RawTxn,
  occurrenceIndex: number,
): string {
  return createHash("sha256")
    .update(
      [
        accountId,
        txn.date,
        txn.amountCents,
        normalizeDescription(txn.description),
        occurrenceIndex,
      ].join("|"),
    )
    .digest("hex");
}

/** Assign occurrence indexes to identical rows within one parsed file. */
export function withDedupeHashes(
  accountId: number,
  txns: RawTxn[],
): (RawTxn & { dedupeHash: string })[] {
  const seen = new Map<string, number>();
  return txns.map((txn) => {
    const key = `${txn.date}|${txn.amountCents}|${normalizeDescription(txn.description)}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return { ...txn, dedupeHash: dedupeHash(accountId, txn, occurrence) };
  });
}
