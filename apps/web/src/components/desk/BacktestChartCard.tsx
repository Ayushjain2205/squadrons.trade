"use client";

import type { BacktestArtifact } from "@squadrons/shared";

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact equity-curve card for chat generative UI. */
export function BacktestChartCard({
  artifact,
}: {
  artifact: BacktestArtifact;
}) {
  const { stats, equityCurve, title, summary, engine, notes } = artifact;
  const values = equityCurve.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const w = 320;
  const h = 96;
  const padY = 8;

  const points = equityCurve.map((p, i) => {
    const x = (i / Math.max(equityCurve.length - 1, 1)) * w;
    const y = padY + (1 - (p.v - min) / span) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const up = stats.totalReturnPct >= 0;

  return (
    <div className="mt-2 max-w-[min(100%,var(--measure-chat))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
        <div className="min-w-0">
          <p className="type-ui truncate font-semibold text-[var(--ink)]">
            {title}
          </p>
          <p className="type-meta mt-0.5 text-[var(--muted)]">{summary}</p>
        </div>
        <span className="type-meta shrink-0 rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[var(--ink-soft)]">
          {engine === "tenderly" ? "Tenderly" : "Sim"}
        </span>
      </div>

      <div className="px-2 pt-2">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-24 w-full"
          role="img"
          aria-label={`Equity curve for ${title}`}
        >
          <defs>
            <linearGradient id="bt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={up ? "var(--accent)" : "var(--danger)"}
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor={up ? "var(--accent)" : "var(--danger)"}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#bt-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke={up ? "var(--accent)" : "var(--danger)"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--line-soft)] px-3.5 py-2.5 sm:grid-cols-4">
        <Stat label="Return" value={formatPct(stats.totalReturnPct)} warn={!up} />
        <Stat label="Max DD" value={formatPct(-Math.abs(stats.maxDrawdownPct))} warn />
        <Stat label="Sharpe" value={stats.sharpe.toFixed(2)} />
        <Stat
          label="End"
          value={formatUsd(stats.endEquity)}
        />
      </div>

      {notes && notes.length > 0 ? (
        <p className="type-meta border-t border-[var(--line-soft)] px-3.5 py-2 text-[var(--muted)]">
          {notes[0]}
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="type-meta text-[var(--muted)]">{label}</p>
      <p
        className={`type-data truncate !text-[length:var(--text-ui)] ${
          warn ? "!text-[var(--warn)]" : "!text-[var(--ink)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
