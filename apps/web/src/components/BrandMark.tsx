"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AGENT_COLORS,
  AGENT_FACES,
  type AvatarId,
  type OrbColorId,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

const STORAGE_KEY = "squadrons-brand-orb";

type BrandOrbPick = {
  avatarId: AvatarId;
  colorId: OrbColorId;
};

function pickRandomOrb(): BrandOrbPick {
  const avatarId =
    AGENT_FACES[Math.floor(Math.random() * AGENT_FACES.length)]!.id;
  const colorId =
    AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)]!.id;
  return { avatarId, colorId };
}

function readStoredOrb(): BrandOrbPick | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrandOrbPick>;
    const faceOk = AGENT_FACES.some((f) => f.id === parsed.avatarId);
    const colorOk = AGENT_COLORS.some((c) => c.id === parsed.colorId);
    if (faceOk && colorOk) {
      return {
        avatarId: parsed.avatarId as AvatarId,
        colorId: parsed.colorId as OrbColorId,
      };
    }
  } catch {
    // ignore bad storage
  }
  return null;
}

/**
 * Wordmark + session-stable random orb. Hover wakes the eyes and gives the
 * orb a light bob (trigger → hover; feedback → eye live + transform).
 */
export function BrandMark({
  className = "",
  textClassName = "text-[length:var(--text-brand-rail)]",
  orbSize = 36,
}: {
  className?: string;
  textClassName?: string;
  orbSize?: number;
}) {
  const [orb, setOrb] = useState<BrandOrbPick>({
    avatarId: "01",
    colorId: "green",
  });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const stored = readStoredOrb();
    if (stored) {
      setOrb(stored);
      return;
    }
    const next = pickRandomOrb();
    setOrb(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // private mode / quota
    }
  }, []);

  return (
    <Link
      href="/"
      className={`brand-mark group flex items-center gap-2.5 px-1 pt-1 text-[var(--ink)] transition hover:opacity-95 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <span className="brand-orb inline-flex shrink-0">
        <AgentOrb
          id={orb.avatarId}
          colorId={orb.colorId}
          size={orbSize}
          animate={hovered}
          title="Squadrons"
        />
      </span>
      <span
        className={`type-brand ${textClassName}`}
      >
        Squadrons
      </span>
    </Link>
  );
}
