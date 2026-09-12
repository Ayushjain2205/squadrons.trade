"use client";

import Link from "next/link";
import { OrbField, type OrbFieldItem } from "@/components/OrbField";

const PREVIEW: OrbFieldItem[] = [
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
  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-14 text-center">
      <OrbField
        orbs={PREVIEW}
        className="h-[172px] w-[min(100%,300px)]"
      />

      <div className="max-w-md space-y-3">
        <p className="type-display">Create your first agent</p>
        <p className="type-ui text-[var(--ink-soft)]">
          Name it, pick a face, then put it on a chain — Observe by default,
          then Paper before Live.
        </p>
      </div>

      <Link
        href="/agents/new"
        className="type-ui inline-flex cursor-pointer rounded-full bg-[var(--ink)] px-5 py-2.5 font-semibold text-[var(--canvas)] transition hover:opacity-90"
      >
        New agent
      </Link>
    </div>
  );
}
