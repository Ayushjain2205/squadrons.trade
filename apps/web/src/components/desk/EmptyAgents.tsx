"use client";

import Link from "next/link";
import { useState } from "react";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

/** Curated preview roster — characterful, not a rainbow dump. */
const PREVIEW: Array<{
  id: AvatarId;
  colorId: OrbColorId;
  x: string;
  y: string;
  size: number;
  rotate: string;
  delay: string;
}> = [
  { id: "05", colorId: "blue", x: "6%", y: "16%", size: 56, rotate: "-12deg", delay: "0s" },
  { id: "01", colorId: "green", x: "36%", y: "0%", size: 74, rotate: "4deg", delay: "0.35s" },
  { id: "08", colorId: "orange", x: "68%", y: "12%", size: 52, rotate: "10deg", delay: "0.7s" },
  { id: "02", colorId: "pink", x: "16%", y: "56%", size: 48, rotate: "-6deg", delay: "0.15s" },
  { id: "07", colorId: "purple", x: "48%", y: "50%", size: 62, rotate: "8deg", delay: "0.5s" },
  { id: "04", colorId: "yellow", x: "76%", y: "58%", size: 44, rotate: "-14deg", delay: "0.9s" },
];

/**
 * First-run empty desk: a waiting squadron of orbs so the void reads as
 * "roster not yet filled" rather than a blank marketing panel.
 */
export function EmptyAgents() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-14 text-center">
      <div
        className="empty-squadron relative h-[172px] w-[min(100%,300px)]"
        aria-hidden
      >
        <div className="empty-squadron-glow pointer-events-none absolute inset-[-24%] rounded-full" />
        {PREVIEW.map((orb, index) => {
          const awake = active === index;
          return (
            <div
              key={`${orb.id}-${orb.colorId}`}
              className="empty-squadron-orb absolute"
              style={{
                left: orb.x,
                top: orb.y,
                ["--orb-delay" as string]: orb.delay,
                zIndex: awake ? 4 : 1,
              }}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className={`empty-squadron-orb-face ${awake ? "is-awake" : ""}`}
                style={{ ["--orb-rotate" as string]: orb.rotate }}
              >
                <AgentOrb
                  id={orb.id}
                  colorId={orb.colorId}
                  size={orb.size}
                  animate={awake}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-md space-y-3">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em]">
          Create your first agent
        </p>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Name it, pick a face, then put it on a chain — observe by default,
          spend only when you flip the switch.
        </p>
      </div>

      <Link
        href="/agents/new"
        className="inline-flex cursor-pointer rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:opacity-90"
      >
        New agent
      </Link>
    </div>
  );
}
