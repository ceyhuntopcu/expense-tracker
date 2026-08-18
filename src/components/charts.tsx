import Link from "next/link";
import { formatCents } from "@/lib/budget";

export function categoryColor(token: string): string {
  return `var(--color-${token})`;
}

/** "$1,234" — whole dollars for chart labels where cents are noise. */
function wholeDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
}

/**
 * Full-width proportional strip: one colored segment per category.
 * The at-a-glance "shape of the month" under the headline figures.
 */
export function CompositionStrip({
  data,
  total,
}: {
  data: { name: string; colorToken: string; cents: number }[];
  total: number;
}) {
  if (total <= 0) return null;
  return (
    <div>
      <svg
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        className="w-full h-4 block"
      >
        {(() => {
          let x = 0;
          return data.map((d) => {
            const w = (d.cents / total) * 100;
            const seg = (
              <rect
                key={d.name}
                x={x}
                y="0"
                width={Math.max(w - 0.35, 0.1)}
                height="1"
                fill={categoryColor(d.colorToken)}
              />
            );
            x += w;
            return seg;
          });
        })()}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {data.slice(0, 6).map((d) => (
          <span key={d.name} className="flex items-baseline gap-1.5 text-[13px]">
            <span
              aria-hidden
              className="self-center size-2 shrink-0"
              style={{ background: categoryColor(d.colorToken) }}
            />
            <span className="text-ink-soft">{d.name}</span>
            <span className="figure text-ink-faint">
              {Math.round((d.cents / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The main "where it went" list: generous rows, serif amounts, share of
 * spending, entry counts, dominant merchant, and month-over-month movement.
 */
export function CategoryRows({
  data,
  total,
}: {
  data: {
    name: string;
    colorToken: string;
    cents: number;
    count: number;
    topMerchant?: string;
    prevCents?: number;
    href?: string;
  }[];
  total: number;
}) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  return (
    <div>
      {data.map((d) => {
        const share = total > 0 ? Math.round((d.cents / total) * 100) : 0;
        const delta =
          d.prevCents !== undefined && d.prevCents > 0
            ? d.cents - d.prevCents
            : null;
        return (
          <div key={d.name} className="rule-b py-5 first:pt-1">
            <div className="flex items-baseline justify-between gap-4 mb-2.5">
              {d.href ? (
                <Link
                  href={d.href}
                  className="text-[17px] hover:text-moss hover:underline decoration-1 underline-offset-4 transition-colors"
                >
                  {d.name} <span className="text-ink-faint text-[13px]">→</span>
                </Link>
              ) : (
                <span className="text-[17px]">{d.name}</span>
              )}
              <span className="display-figure text-[22px] whitespace-nowrap">
                {formatCents(d.cents)}
              </span>
            </div>
            <svg
              viewBox="0 0 100 1"
              preserveAspectRatio="none"
              className="w-full h-2.5 block"
            >
              <rect x="0" y="0" width="100" height="1" fill="var(--color-paper-warm)" />
              <rect
                x="0"
                y="0"
                width={(d.cents / max) * 100}
                height="1"
                fill={categoryColor(d.colorToken)}
              />
            </svg>
            <p className="mt-2 text-[13px] italic text-ink-faint">
              {share}% of the month&apos;s spending ·{" "}
              {d.count === 1 ? "one entry" : `${d.count} entries`}
              {d.topMerchant && d.count > 1 && <> · mostly {d.topMerchant}</>}
              {delta !== null && Math.abs(delta) >= 100 && (
                <span className={delta > 0 ? "text-oxblood" : "text-moss"}>
                  {" "}
                  · {delta > 0 ? "▲" : "▼"} {formatCents(Math.abs(delta))} vs
                  last month
                </span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Spending per calendar day across the month — the rhythm of the money.
 * Quiet days stay quiet; the loudest day gets a label.
 */
export function DailyRhythm({
  month,
  dailyCents,
  daysInMonth,
}: {
  month: string;
  dailyCents: number[]; // index 0 = day 1
  daysInMonth: number;
}) {
  const max = Math.max(...dailyCents, 1);
  const maxDay = dailyCents.indexOf(max);
  const totalDays = daysInMonth;
  const W = 860;
  const H = 96;
  const gap = 5;
  const barW = (W - gap * (totalDays - 1)) / totalDays;
  const avg =
    dailyCents.reduce((s, c) => s + c, 0) /
    Math.max(dailyCents.filter((c) => c > 0).length, 1);

  return (
    <svg viewBox={`0 -24 ${W} ${H + 66}`} className="w-full">
      {/* average-per-active-day line */}
      {avg > 0 && (
        <line
          x1="0"
          y1={H - (avg / max) * H}
          x2={W}
          y2={H - (avg / max) * H}
          stroke="var(--color-rule-strong)"
          strokeWidth="1"
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {Array.from({ length: totalDays }, (_, i) => {
        const cents = dailyCents[i] ?? 0;
        const h = cents > 0 ? Math.max((cents / max) * H, 3) : 0;
        const x = i * (barW + gap);
        const day = i + 1;
        const isMax = i === maxDay && cents > 0;
        return (
          <g key={day}>
            {isMax && (
              <text
                x={Math.min(Math.max(x + barW / 2, 26), W - 26)}
                y={H - h - 8}
                textAnchor="middle"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fill="var(--color-ink)"
              >
                {`$${Math.round(cents / 100).toLocaleString("en-CA")}`}
              </text>
            )}
            {cents > 0 ? (
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                fill={isMax ? "var(--color-moss)" : "var(--color-rule-strong)"}
              >
                <title>{`Day ${day}: ${formatCents(cents)}`}</title>
              </rect>
            ) : (
              <rect
                x={x}
                y={H - 1.5}
                width={barW}
                height={1.5}
                fill="var(--color-rule)"
              />
            )}
            {(day === 1 || day % 5 === 0) && (
              <text
                x={x + barW / 2}
                y={H + 22}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--color-ink-faint)"
              >
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Six columns with dollar labels and a dashed average line. */
export function TrendColumns({
  data,
  currentMonth,
}: {
  data: { month: string; spentCents: number }[];
  currentMonth: string;
}) {
  const max = Math.max(...data.map((d) => d.spentCents), 1);
  const W = 320;
  const H = 150;
  const gap = 12;
  const barW = (W - gap * (data.length - 1)) / data.length;
  const active = data.filter((d) => d.spentCents > 0);
  const avg =
    active.length > 1
      ? active.reduce((s, d) => s + d.spentCents, 0) / active.length
      : 0;

  return (
    <svg viewBox={`0 -22 ${W} ${H + 62}`} className="w-full">
      {avg > 0 && (
        <line
          x1="0"
          y1={H - (avg / max) * H}
          x2={W}
          y2={H - (avg / max) * H}
          stroke="var(--color-rule-strong)"
          strokeWidth="1"
          strokeDasharray="3 5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {data.map((d, i) => {
        const h = Math.max((d.spentCents / max) * H, d.spentCents > 0 ? 3 : 0);
        const x = i * (barW + gap);
        const active = d.month === currentMonth;
        return (
          <g key={d.month}>
            {d.spentCents > 0 && (
              <text
                x={x + barW / 2}
                y={H - h - 7}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill={active ? "var(--color-ink)" : "var(--color-ink-faint)"}
              >
                {wholeDollars(d.spentCents)}
              </text>
            )}
            <rect
              x={x}
              y={H - h}
              width={barW}
              height={h}
              fill={active ? "var(--color-moss)" : "var(--color-rule)"}
            />
            <line
              x1={x}
              y1={H}
              x2={x + barW}
              y2={H}
              stroke="var(--color-rule-strong)"
              strokeWidth="1"
            />
            <text
              x={x + barW / 2}
              y={H + 20}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
              fill={active ? "var(--color-ink)" : "var(--color-ink-faint)"}
            >
              {monthShort(d.month).toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function monthShort(month: string): string {
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return names[Number(month.slice(5)) - 1];
}

/** Ranked merchants with a quiet proportional underline. */
export function MerchantRows({
  data,
}: {
  data: { merchant: string; cents: number; count: number }[];
}) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  return (
    <ol className="space-y-4">
      {data.map((d, i) => (
        <li key={d.merchant}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-[15px] truncate">
              <span className="figure text-ink-faint mr-2">{i + 1}</span>
              {d.merchant}
              {d.count > 1 && (
                <span className="italic text-ink-faint text-[13px]">
                  {" "}
                  × {d.count}
                </span>
              )}
            </span>
            <span className="figure text-[15px] whitespace-nowrap">
              {formatCents(d.cents)}
            </span>
          </div>
          <svg
            viewBox="0 0 100 1"
            preserveAspectRatio="none"
            className="w-full h-[3px] block"
          >
            <rect x="0" y="0" width="100" height="1" fill="var(--color-paper-warm)" />
            <rect
              x="0"
              y="0"
              width={(d.cents / max) * 100}
              height="1"
              fill="var(--color-rule-strong)"
            />
          </svg>
        </li>
      ))}
    </ol>
  );
}

/** Budget vs actual: track = budget, fill = actual; overshoot turns oxblood. */
export function BudgetBar({
  budgetCents,
  actualCents,
  colorToken,
}: {
  budgetCents: number;
  actualCents: number;
  colorToken: string;
}) {
  const over = budgetCents > 0 && actualCents > budgetCents;
  const pct =
    budgetCents > 0 ? Math.min((actualCents / budgetCents) * 100, 100) : 0;
  return (
    <svg
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      className="w-full h-[7px] block"
    >
      <rect x="0" y="0.15" width="100" height="0.7" fill="var(--color-paper-warm)" />
      <rect
        x="0" y="0"
        width={pct} height="1"
        fill={over ? "var(--color-oxblood)" : categoryColor(colorToken)}
      />
      {over && (
        <line
          x1="99.4" y1="-0.4" x2="99.4" y2="1.4"
          stroke="var(--color-oxblood)" strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
