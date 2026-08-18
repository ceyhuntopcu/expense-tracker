import type { Category, Rule } from "@/db/schema";

/**
 * Built-in merchant keywords → default category names. User rules always win;
 * these only fill the gaps. Matched case-insensitively against
 * `description + merchant`.
 */
const BUILTIN_KEYWORDS: [string, string][] = [
  // Groceries
  ["loblaws", "Groceries"], ["no frills", "Groceries"], ["nofrills", "Groceries"],
  ["metro", "Groceries"], ["sobeys", "Groceries"], ["freshco", "Groceries"],
  ["food basics", "Groceries"], ["farm boy", "Groceries"], ["costco", "Groceries"],
  ["walmart", "Groceries"], ["t&t", "Groceries"], ["superstore", "Groceries"],
  // Dining & Coffee
  ["tim hortons", "Dining & Coffee"], ["starbucks", "Dining & Coffee"],
  ["mcdonald", "Dining & Coffee"], ["a&w", "Dining & Coffee"],
  ["subway", "Dining & Coffee"], ["uber eats", "Dining & Coffee"],
  ["ubereats", "Dining & Coffee"], ["doordash", "Dining & Coffee"],
  ["skipthedishes", "Dining & Coffee"], ["restaurant", "Dining & Coffee"],
  ["cafe", "Dining & Coffee"], ["pizza", "Dining & Coffee"],
  // Transport
  ["presto", "Transport"], ["ttc", "Transport"], ["go transit", "Transport"],
  ["uber", "Transport"], ["lyft", "Transport"], ["petro", "Transport"],
  ["esso", "Transport"], ["shell", "Transport"], ["via rail", "Transport"],
  // Subscriptions
  ["netflix", "Subscriptions"], ["spotify", "Subscriptions"],
  ["disney", "Subscriptions"], ["crave", "Subscriptions"],
  ["apple.com", "Subscriptions"], ["youtube", "Subscriptions"],
  ["amazon prime", "Subscriptions"], ["icloud", "Subscriptions"],
  ["openai", "Subscriptions"], ["patreon", "Subscriptions"],
  // Bills & Utilities
  ["rogers", "Bills & Utilities"], ["bell", "Bills & Utilities"],
  ["telus", "Bills & Utilities"], ["fido", "Bills & Utilities"],
  ["freedom mobile", "Bills & Utilities"], ["koodo", "Bills & Utilities"],
  ["hydro", "Bills & Utilities"], ["enbridge", "Bills & Utilities"],
  ["insurance", "Bills & Utilities"],
  // Health
  ["shoppers drug", "Health"], ["pharma", "Health"], ["rexall", "Health"],
  ["dental", "Health"], ["physio", "Health"], ["gym", "Health"],
  ["goodlife", "Health"],
  // Shopping
  ["amazon", "Shopping"], ["winners", "Shopping"], ["ikea", "Shopping"],
  ["canadian tire", "Shopping"], ["best buy", "Shopping"], ["uniqlo", "Shopping"],
  ["zara", "Shopping"], ["h&m", "Shopping"], ["dollarama", "Shopping"],
  // Entertainment
  ["cineplex", "Entertainment"], ["steam", "Entertainment"],
  ["playstation", "Entertainment"], ["nintendo", "Entertainment"],
  ["ticketmaster", "Entertainment"],
  // Housing
  ["rent", "Rent & Housing"], ["mortgage", "Rent & Housing"],
  // Income
  ["payroll", "Income"], ["pay deposit", "Income"], ["direct deposit", "Income"],
  ["salary", "Income"],
];

const TRANSFER_PATTERNS =
  /payment\s*-?\s*thank you|thank you for your payment|credit card payment|tfr[-\s]?(to|fr)|trf(out|in)|transfer (to|from|out|in)\b|e-?transfer|wealthsimple cash|balance transfer|aft_?(in|out)|(from|to) (chequing|savings)/i;

export type Categorization = {
  categoryId: number | null;
  isTransfer: boolean;
};

/**
 * Priority: user rules (by descending priority, then newest) → built-in
 * keywords → income guess for large credits → uncategorized.
 */
export function categorize(
  description: string,
  merchant: string,
  amountCents: number,
  rules: Rule[],
  categories: Category[],
): Categorization {
  const haystack = `${description} ${merchant}`.toLowerCase();
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  // User rules and recognizable merchants win over transfer heuristics —
  // e.g. a payroll deposit arrives as AFT_IN but is income, not a transfer.
  const sortedRules = [...rules].sort(
    (a, b) => b.priority - a.priority || b.id - a.id,
  );
  for (const rule of sortedRules) {
    if (haystack.includes(rule.pattern.toLowerCase())) {
      return { categoryId: rule.categoryId, isTransfer: false };
    }
  }

  for (const [keyword, categoryName] of BUILTIN_KEYWORDS) {
    if (haystack.includes(keyword)) {
      const category = byName.get(categoryName.toLowerCase());
      if (category) return { categoryId: category.id, isTransfer: false };
    }
  }

  if (TRANSFER_PATTERNS.test(haystack)) {
    return {
      categoryId: byName.get("transfers")?.id ?? null,
      isTransfer: true,
    };
  }

  return { categoryId: null, isTransfer: false };
}
