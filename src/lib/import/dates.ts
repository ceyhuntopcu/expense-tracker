const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function pad(n: string): string {
  return n.padStart(2, "0");
}

/**
 * Parse the date formats Canadian bank exports actually use, without ever
 * constructing a Date object (no timezone drift). Returns YYYY-MM-DD or null.
 */
export function parseStatementDate(input: string): string | null {
  const s = input.trim();

  // 2026-08-13 or 2026/08/13
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

  // 8/13/2026 or 08-13-2026 (month first — Scotiabank CSV convention)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;

  // "Aug 13, 2026" / "13 Aug 2026" / "August 13 2026"
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${pad(m[2])}`;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${pad(m[1])}`;
  }

  return null;
}

/**
 * PDF statement lines often omit the year ("Aug 13"). Resolve against the
 * statement period: pick the year that keeps the date inside [start, end].
 */
export function resolveYearlessDate(
  monthName: string,
  day: string,
  periodStart: string, // YYYY-MM-DD
  periodEnd: string,
): string | null {
  const mo = MONTHS[monthName.slice(0, 3).toLowerCase()];
  if (!mo) return null;
  const startYear = Number(periodStart.slice(0, 4));
  const endYear = Number(periodEnd.slice(0, 4));
  for (const year of new Set([startYear, endYear])) {
    const candidate = `${year}-${mo}-${pad(day)}`;
    if (candidate >= periodStart && candidate <= periodEnd) return candidate;
  }
  return `${endYear}-${mo}-${pad(day)}`;
}

/** "$1,234.56", "-1234.56", "(1,234.56)" → cents. Parens mean negative. */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = "0"] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}
