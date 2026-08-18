import type { StatementParser } from "../types";
import { parseStatementLines } from "./pdf-lines";

export const wealthsimplePdf: StatementParser = {
  id: "wealthsimple-pdf",
  label: "Wealthsimple PDF statement",
  format: "pdf",
  bank: "wealthsimple",

  detect(text) {
    return /wealthsimple/i.test(text);
  },

  parse(text) {
    return parseStatementLines(text);
  },
};
