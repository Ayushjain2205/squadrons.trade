import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { DEFAULT_ORB_COLOR, getOrbColor, AGENT_FACES } from "@squadrons/shared";

function Eyes({ id, eye }: { id: AvatarId; eye: string }) {
  switch (id) {
    case "01":
      return (
        <>
          <rect x="28" y="46" width="14" height="4" rx="1" fill={eye} />
          <rect x="58" y="46" width="14" height="4" rx="1" fill={eye} />
        </>
      );
    case "02":
      return (
        <>
          <rect x="32" y="40" width="6" height="16" rx="3" fill={eye} />
          <rect x="62" y="40" width="6" height="16" rx="3" fill={eye} />
        </>
      );
    case "03":
      return (
        <>
          <rect
            x="30"
            y="42"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke={eye}
            strokeWidth="2.5"
          />
          <rect
            x="58"
            y="42"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke={eye}
            strokeWidth="2.5"
          />
        </>
      );
    case "04":
      return (
        <>
          <rect x="30" y="48" width="5" height="5" fill={eye} />
          <rect x="36" y="42" width="5" height="5" fill={eye} />
          <rect x="58" y="48" width="5" height="5" fill={eye} />
          <rect x="64" y="42" width="5" height="5" fill={eye} />
        </>
      );
    case "05":
      return (
        <>
          <path
            d="M34 40 L40 48 L34 56"
            fill="none"
            stroke={eye}
            strokeWidth="3"
            strokeLinecap="square"
          />
          <path
            d="M66 40 L60 48 L66 56"
            fill="none"
            stroke={eye}
            strokeWidth="3"
            strokeLinecap="square"
          />
        </>
      );
    case "06":
      return (
        <>
          <rect x="28" y="46" width="4" height="4" fill={eye} />
          <rect x="34" y="46" width="4" height="4" fill={eye} />
          <rect x="40" y="46" width="4" height="4" fill={eye} />
          <rect x="56" y="46" width="4" height="4" fill={eye} />
          <rect x="62" y="46" width="4" height="4" fill={eye} />
          <rect x="68" y="46" width="4" height="4" fill={eye} />
        </>
      );
    case "07":
      return (
        <>
          <rect
            x="30"
            y="46"
            width="12"
            height="3.5"
            rx="1"
            fill={eye}
            transform="rotate(-8 36 48)"
          />
          <rect
            x="58"
            y="46"
            width="12"
            height="3.5"
            rx="1"
            fill={eye}
            transform="rotate(8 64 48)"
          />
        </>
      );
    case "08":
      return (
        <>
          <path
            d="M36 42 V54 M30 48 H42"
            stroke={eye}
            strokeWidth="3"
            strokeLinecap="square"
          />
          <path
            d="M64 42 V54 M58 48 H70"
            stroke={eye}
            strokeWidth="3"
            strokeLinecap="square"
          />
        </>
      );
  }
}

type AgentOrbProps = {
  id: AvatarId;
  colorId?: OrbColorId;
  size?: number;
  className?: string;
  title?: string;
};

export function AgentOrb({
  id,
  colorId = DEFAULT_ORB_COLOR,
  size = 56,
  className,
  title,
}: AgentOrbProps) {
  const face = AGENT_FACES.find((entry) => entry.id === id);
  const palette = getOrbColor(colorId);
  const gradientId = `orb-${id}-${colorId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={title ?? face?.name ?? id}
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor={palette.gloss} />
          <stop offset="55%" stopColor={palette.orb} />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} />
      <ellipse
        cx="38"
        cy="28"
        rx="18"
        ry="10"
        fill="white"
        opacity="0.18"
      />
      <Eyes id={id} eye={palette.eye} />
    </svg>
  );
}
