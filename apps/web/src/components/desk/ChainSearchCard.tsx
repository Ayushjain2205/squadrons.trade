"use client";

import type { ChainSearchArtifact, ChainSearchHit } from "@squadrons/shared";

/** Ranked onchain search hits — compact chat GenUI card. */
export function ChainSearchCard({
  artifact,
}: {
  artifact: ChainSearchArtifact;
}) {
  const { title, summary, query, hits, notes, engine } = artifact;

  return (
    <div className="mt-2 max-w-[min(100%,var(--measure-chat))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <header className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <p className="type-ui truncate font-semibold leading-tight text-[var(--ink)]">
            {title}
          </p>
          <p className="type-meta mt-0.5 line-clamp-2 leading-snug text-[var(--muted)]">
            {summary}
          </p>
        </div>
        <span className="type-meta shrink-0 rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-[var(--ink-soft)]">
          {engine === "the-graph" ? "The Graph" : engine}
        </span>
      </header>

      <p className="type-meta truncate border-y border-[var(--line-soft)] px-3 py-1 text-[var(--muted)]">
        <span className="text-[var(--ink-soft)]">Query</span>
        <span className="mx-1.5 text-[var(--line)]">·</span>
        <span className="text-[var(--ink-soft)]">{query}</span>
      </p>

      <ol className="px-1.5 py-1">
        {hits.map((hit, index) => (
          <HitRow key={`${hit.title}-${index}`} hit={hit} rank={index + 1} />
        ))}
      </ol>

      {notes && notes.length > 0 ? (
        <p className="type-meta border-t border-[var(--line-soft)] px-3 py-1.5 text-[var(--muted)]">
          {notes.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function HitRow({ hit, rank }: { hit: ChainSearchHit; rank: number }) {
  const metrics = (hit.metrics ?? []).map(compactMetric).filter(Boolean);
  const rowClass =
    "flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-[var(--panel-2)]";

  const body = (
    <>
      <span className="type-meta w-4 shrink-0 text-right tabular-nums text-[var(--muted)]">
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="type-ui min-w-0 truncate font-medium leading-tight text-[var(--ink)]">
            {hit.title}
          </span>
          <span className="type-meta shrink-0 capitalize text-[var(--muted)]">
            {hit.kind}
          </span>
        </span>
        {hit.subtitle ? (
          <span className="type-meta mt-0.5 block truncate leading-snug text-[var(--muted)]">
            {hit.subtitle}
          </span>
        ) : null}
        {metrics.length > 0 ? (
          <span className="type-meta mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug text-[var(--ink-soft)]">
            {metrics.map((metric, i) => (
              <span
                key={`${metric}-${i}`}
                className="inline-flex items-center gap-1.5"
              >
                {i > 0 ? (
                  <span className="text-[var(--line)]" aria-hidden>
                    ·
                  </span>
                ) : null}
                <MetricChip text={metric!} />
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  if (hit.url) {
    return (
      <li>
        <a href={hit.url} target="_blank" rel="noreferrer" className={rowClass}>
          {body}
        </a>
      </li>
    );
  }

  return <li className={rowClass}>{body}</li>;
}

function MetricChip({ text }: { text: string }) {
  const isMoney =
    /\$[\d.,]+[KMBTkmbt]?/.test(text) || /tvl|volume|vol/i.test(text);
  const isAddr = /0x[a-fA-F0-9]{6,}/.test(text) || /^pool:/i.test(text);

  let color = "var(--ink-soft)";
  if (isMoney) color = "var(--accent)";
  else if (isAddr) color = "var(--muted)";

  return (
    <span className="whitespace-nowrap" style={{ color }}>
      {text}
    </span>
  );
}

/** Shorten pool addresses for one-line density. */
function compactMetric(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const poolMatch = text.match(/^(pool:\s*)(0x[a-fA-F0-9]{40})(.*)$/i);
  if (poolMatch) {
    const addr = poolMatch[2]!;
    return `${poolMatch[1]}${addr.slice(0, 6)}…${addr.slice(-4)}${poolMatch[3] ?? ""}`;
  }

  const bareAddr = text.match(/^(0x[a-fA-F0-9]{40})$/);
  if (bareAddr) {
    const addr = bareAddr[1]!;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  return text;
}
