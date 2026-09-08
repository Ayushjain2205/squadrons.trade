import type { OrbColorId } from "@squadrons/shared";
import { getOrbColor } from "@squadrons/shared";

/** Plain color disc for pickers — no face. */
export function OrbColorSwatch({
  colorId,
  size = 44,
  className,
}: {
  colorId: OrbColorId;
  size?: number;
  className?: string;
}) {
  const palette = getOrbColor(colorId);
  return (
    <span
      className={`block shrink-0 rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${palette.gloss} 0%, ${palette.orb} 55%, #1a1a1a 100%)`,
      }}
      aria-hidden
    />
  );
}
