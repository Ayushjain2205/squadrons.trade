import type { CSSProperties } from "react";
import { BrandMark } from "@/components/BrandMark";

/**
 * Desk-shaped loading placeholders.
 * Trigger: system data fetch / auth boot
 * Rules: mirror real chrome geometry; never invent fake copy
 * Feedback: soft shimmer on charcoal bones
 * Loops: shimmer until content replaces; reduced-motion → static tint
 */

export function SkeletonBone({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`skeleton-bone block ${className}`}
      style={style}
      aria-hidden
    />
  );
}

function AgentRowSkeleton({
  orbSize = 40,
  nameWidth = "42%",
  previewWidth = "72%",
  className = "",
}: {
  orbSize?: number;
  nameWidth?: string;
  previewWidth?: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <SkeletonBone
        className="shrink-0 rounded-full"
        style={{ width: orbSize, height: orbSize }}
      />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <SkeletonBone className="h-3.5" style={{ width: nameWidth }} />
          <SkeletonBone className="h-2.5 w-8 shrink-0" />
        </div>
        <SkeletonBone className="h-2.5" style={{ width: previewWidth }} />
      </div>
    </div>
  );
}

export function RailListSkeleton({ rows = 5 }: { rows?: number }) {
  const widths = ["42%", "56%", "38%", "48%", "51%"];
  const previews = ["72%", "64%", "80%", "58%", "70%"];
  return (
    <ul className="space-y-0.5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i}>
          <AgentRowSkeleton
            className="px-2.5 py-2.5"
            nameWidth={widths[i % widths.length]}
            previewWidth={previews[i % previews.length]}
          />
        </li>
      ))}
    </ul>
  );
}

/** Mobile home list only — desktop center stays quiet (rail already skeletons). */
export function HomeCenterSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading agents"
    >
      <header className="flex shrink-0 items-center border-b border-[var(--line-soft)] px-5 py-3 md:hidden">
        <BrandMark
          className="pt-0"
          textClassName="text-[length:var(--text-brand-rail-sm)]"
          orbSize={32}
        />
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto md:hidden">
        <ul className="divide-y divide-[var(--line-soft)]" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="px-4 py-3.5">
              <AgentRowSkeleton
                orbSize={44}
                nameWidth={["48%", "40%", "55%", "36%", "50%", "44%"][i]}
                previewWidth={["70%", "62%", "78%", "58%", "66%", "74%"][i]}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden min-h-0 flex-1 md:block" aria-hidden />
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading agent"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
        <SkeletonBone className="size-5 shrink-0 rounded-md md:hidden" />
        <SkeletonBone className="size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBone className="h-4 w-36 max-w-[55%]" />
          <SkeletonBone className="h-2.5 w-52 max-w-[75%]" />
        </div>
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3" aria-hidden>
          <div className="flex justify-start">
            <SkeletonBone className="h-20 w-[min(100%,22rem)] rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <SkeletonBone className="h-12 w-[min(100%,16rem)] rounded-2xl !bg-[var(--msg-user)]" />
          </div>
          <div className="flex justify-start">
            <SkeletonBone className="h-28 w-[min(100%,26rem)] rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <SkeletonBone className="h-10 w-[min(100%,12rem)] rounded-2xl !bg-[var(--msg-user)]" />
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <SkeletonBone className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}

export function ContextPanelSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading context"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line-soft)] px-4 py-3">
        <SkeletonBone className="h-4 w-20" />
        <SkeletonBone className="size-8 rounded-lg" />
      </div>
      <div className="desk-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="space-y-2">
          <SkeletonBone className="h-3.5 w-full" />
          <SkeletonBone className="h-3.5 w-[88%]" />
          <SkeletonBone className="h-3.5 w-[72%]" />
          <SkeletonBone className="mt-2 h-2.5 w-40" />
        </div>
        <div className="space-y-3">
          <SkeletonBone className="h-4 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <SkeletonBone className="mt-1.5 size-1.5 shrink-0 rounded-full" />
              <SkeletonBone
                className="h-3.5 flex-1"
                style={{ width: ["90%", "76%", "84%", "68%"][i] }}
              />
              <SkeletonBone className="mt-0.5 h-2.5 w-6 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Quiet desk shell used while Privy rehydrates a known Squadrons session. */
export function DeskBootSkeleton({
  center = "home",
}: {
  center?: "home" | "chat";
}) {
  return (
    <div
      className="flex h-dvh min-h-0 overflow-hidden bg-[var(--canvas)] text-[var(--ink)]"
      aria-busy="true"
      aria-label="Loading desk"
    >
      <aside className="hidden h-full w-[min(100%,var(--rail-left))] shrink-0 flex-col border-r border-[var(--line-soft)] bg-[var(--rail)] md:flex">
        <div className="shrink-0 space-y-3 p-3 pb-2">
          <BrandMark />
          <SkeletonBone className="h-10 w-full rounded-xl" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
          <RailListSkeleton />
        </div>
        <div className="shrink-0 space-y-1 border-t border-[var(--line-soft)] p-3">
          <div className="flex items-center gap-2.5 px-2.5 py-2.5">
            <SkeletonBone className="size-8 rounded-lg" />
            <SkeletonBone className="h-3.5 w-24" />
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <SkeletonBone className="size-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonBone className="h-3.5 w-28" />
              <SkeletonBone className="h-2.5 w-14" />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[var(--canvas)]">
        {center === "chat" ? <ChatSkeleton /> : <HomeCenterSkeleton />}
      </main>

      <aside className="hidden min-h-0 w-[var(--rail-right)] shrink-0 flex-col border-l border-[var(--line-soft)] bg-[var(--rail)] lg:flex">
        {center === "chat" ? (
          <ContextPanelSkeleton />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <SkeletonBone className="h-3.5 w-48" />
          </div>
        )}
      </aside>
    </div>
  );
}

/** Brand-centered boot while Privy resolves with no Squadrons session. */
export function AuthBootSkeleton() {
  return (
    <div
      className="auth-gate relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--canvas)] px-6 text-center"
      aria-busy="true"
      aria-label="Loading Squadrons"
    >
      <div className="auth-gate-wash pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-1">
          <div
            className="flex items-end justify-center -space-x-4 pb-1"
            aria-hidden
          >
            {[52, 60, 72, 58, 50].map((size, i) => (
              <SkeletonBone
                key={i}
                className="shrink-0 rounded-full"
                style={{
                  width: size,
                  height: size,
                  translate: `0 ${[10, -6, 14, -4, 8][i]}px`,
                }}
              />
            ))}
          </div>
          <SkeletonBone className="mt-2 h-12 w-56 sm:h-14 sm:w-64" />
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <SkeletonBone className="h-3.5 w-full" />
          <SkeletonBone className="h-3.5 w-[78%]" />
        </div>

        <SkeletonBone className="h-12 w-28 rounded-full" />
      </div>
    </div>
  );
}

