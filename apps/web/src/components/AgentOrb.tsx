import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { DEFAULT_ORB_COLOR, getOrbColor, AGENT_FACES } from "@squadrons/shared";

function Eyes({
  id,
  eye,
  animate,
}: {
  id: AvatarId;
  eye: string;
  animate: boolean;
}) {
  const live = animate ? "is-live" : "";

  switch (id) {
    case "01":
      return (
        <g className={`orb-eyes orb-eyes-01 ${live}`} style={{ color: eye }}>
          <rect
            className="orb-eye orb-eye-l"
            x="28"
            y="46"
            width="14"
            height="4"
            rx="1"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-eye-r"
            x="58"
            y="46"
            width="14"
            height="4"
            rx="1"
            fill="currentColor"
          />
        </g>
      );
    case "02":
      return (
        <g className={`orb-eyes orb-eyes-02 ${live}`} style={{ color: eye }}>
          <rect
            className="orb-eye orb-eye-l"
            x="32"
            y="40"
            width="6"
            height="16"
            rx="3"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-eye-r"
            x="62"
            y="40"
            width="6"
            height="16"
            rx="3"
            fill="currentColor"
          />
        </g>
      );
    case "03":
      return (
        <g className={`orb-eyes orb-eyes-03 ${live}`} style={{ color: eye }}>
          <rect
            className="orb-eye orb-eye-l"
            x="30"
            y="42"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <rect
            className="orb-eye orb-eye-r"
            x="58"
            y="42"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        </g>
      );
    case "04":
      return (
        <g className={`orb-eyes orb-eyes-04 ${live}`} style={{ color: eye }}>
          <rect
            className="orb-eye orb-pix orb-pix-1"
            x="30"
            y="48"
            width="5"
            height="5"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-pix orb-pix-2"
            x="36"
            y="42"
            width="5"
            height="5"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-pix orb-pix-3"
            x="58"
            y="48"
            width="5"
            height="5"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-pix orb-pix-4"
            x="64"
            y="42"
            width="5"
            height="5"
            fill="currentColor"
          />
        </g>
      );
    case "05":
      return (
        <g className={`orb-eyes orb-eyes-05 ${live}`} style={{ color: eye }}>
          <path
            className="orb-eye orb-eye-l"
            d="M34 40 L40 48 L34 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <path
            className="orb-eye orb-eye-r"
            d="M66 40 L60 48 L66 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
        </g>
      );
    case "06":
      return (
        <g className={`orb-eyes orb-eyes-06 ${live}`} style={{ color: eye }}>
          <rect
            className="orb-eye orb-dot orb-dot-1"
            x="28"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-dot orb-dot-2"
            x="34"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-dot orb-dot-3"
            x="40"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-dot orb-dot-4"
            x="56"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-dot orb-dot-5"
            x="62"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
          <rect
            className="orb-eye orb-dot orb-dot-6"
            x="68"
            y="46"
            width="4"
            height="4"
            fill="currentColor"
          />
        </g>
      );
    case "07":
      return (
        <g className={`orb-eyes orb-eyes-07 ${live}`} style={{ color: eye }}>
          {/* Slant lives on the group so CSS eye animation can't wipe it. */}
          <g transform="rotate(-8 36 48)">
            <rect
              className="orb-eye orb-eye-l"
              x="30"
              y="46"
              width="12"
              height="3.5"
              rx="1"
              fill="currentColor"
            />
          </g>
          <g transform="rotate(8 64 48)">
            <rect
              className="orb-eye orb-eye-r"
              x="58"
              y="46"
              width="12"
              height="3.5"
              rx="1"
              fill="currentColor"
            />
          </g>
        </g>
      );
    case "08":
      return (
        <g className={`orb-eyes orb-eyes-08 ${live}`} style={{ color: eye }}>
          <path
            className="orb-eye orb-eye-l"
            d="M36 42 V54 M30 48 H42"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <path
            className="orb-eye orb-eye-r"
            d="M64 42 V54 M58 48 H70"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
        </g>
      );
  }
}

type AgentOrbProps = {
  id: AvatarId;
  colorId?: OrbColorId;
  size?: number;
  className?: string;
  title?: string;
  /** Animate eyes (working state or selected face in pickers). */
  animate?: boolean;
};

export function AgentOrb({
  id,
  colorId = DEFAULT_ORB_COLOR,
  size = 56,
  className,
  title,
  animate = false,
}: AgentOrbProps) {
  const face = AGENT_FACES.find((entry) => entry.id === id);
  const palette = getOrbColor(colorId);
  const gradientId = `orb-${id}-${colorId}-${animate ? "a" : "s"}`;

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
        <radialGradient id={gradientId} cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor={palette.gloss} />
          <stop offset="58%" stopColor={palette.orb} />
          <stop offset="100%" stopColor={palette.shade} />
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
      <Eyes id={id} eye={palette.eye} animate={animate} />
    </svg>
  );
}
