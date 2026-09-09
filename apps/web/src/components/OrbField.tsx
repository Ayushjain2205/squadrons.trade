"use client";

import { useState } from "react";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

export type OrbFieldItem = {
  id: AvatarId;
  colorId: OrbColorId;
  x: string;
  y: string;
  size: number;
  rotate: string;
  delay: string;
};

/** Shared floating orb cluster for empty desk + logged-out surfaces. */
export function OrbField({
  orbs,
  className = "",
}: {
  orbs: OrbFieldItem[];
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className={`orb-field relative ${className}`} aria-hidden>
      <div className="orb-field-glow pointer-events-none absolute inset-[-24%] rounded-full" />
      {orbs.map((orb, index) => {
        const awake = active === index;
        return (
          <div
            key={`${orb.id}-${orb.colorId}-${index}`}
            className="orb-field-orb absolute"
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
              className={`orb-field-face ${awake ? "is-awake" : ""}`}
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
  );
}
