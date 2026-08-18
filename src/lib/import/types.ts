export type RawTxn = {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Negative = money out. Parsers normalize to this convention where known. */
  amountCents: number;
};

export type ParseResult = {
  transactions: RawTxn[];
  /** Lines/rows the parser saw but could not understand — surfaced in preview. */
  skipped: string[];
  /** Low confidence → UI suggests trying the CSV export instead. */
  confidence: "high" | "low";
};

export type StatementParser = {
  id: string;
  label: string;
  format: "csv" | "pdf";
  bank: "wealthsimple" | "scotiabank";
  /** Cheap signature check against file text (CSV) or extracted text (PDF). */
  detect(text: string): boolean;
  parse(text: string): ParseResult;
};
