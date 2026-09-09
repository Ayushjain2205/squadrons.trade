"use client";

import { useEffect, useState } from "react";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

/** Overlapping lineup — different rhythm from the empty-desk scatter. */
const CREW: Array<{
  id: AvatarId;
  colorId: OrbColorId;
  size: number;
  lift: number;
}> = [
  { id: "03", colorId: "blue", size: 52, lift: 10 },
  { id: "06", colorId: "red", size: 60, lift: -6 },
  { id: "01", colorId: "green", size: 72, lift: 14 },
  { id: "08", colorId: "orange", size: 58, lift: -4 },
  { id: "05", colorId: "pink", size: 50, lift: 8 },
];

/**
 * Login visual: a tight overlapping crew perched above the wordmark,
 * with a slow idle wake that cycles faces (scatter + vertical float live
 * on the empty desk instead).
 */
export function LoginCrew() {
  const [active, setActive] = useState(2);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % CREW.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  const awakeIndex = hovered ?? active;

  return (
    <div className="login-crew flex items-end justify-center pl-5" aria-hidden>
      {CREW.map((orb, index) => {
        const awake = awakeIndex === index;
        return (
          <div
            key={`${orb.id}-${orb.colorId}`}
            className={`login-crew-orb ${awake ? "is-awake" : ""}`}
            style={{
              marginLeft: index === 0 ? 0 : -22,
              zIndex: awake ? 6 : index + 1,
              ["--crew-lift" as string]: `${orb.lift}px`,
              ["--crew-delay" as string]: `${index * 0.18}s`,
            }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <AgentOrb
              id={orb.id}
              colorId={orb.colorId}
              size={orb.size}
              animate={awake}
            />
          </div>
        );
      })}
    </div>
  );
}
