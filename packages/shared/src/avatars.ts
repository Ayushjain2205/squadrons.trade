/** Fixed orb-face avatar set (see docs/design/agent-avatars-reference.png). */
export const AGENT_AVATARS = [
  {
    id: "01",
    name: "Slit bars",
    eyes: "Horizontal laser dashes",
    color: "purple",
  },
  {
    id: "02",
    name: "Vertical pills",
    eyes: "Tall vertical columns",
    color: "blue",
  },
  {
    id: "03",
    name: "Hollow frames",
    eyes: "Outline square boxes",
    color: "green",
  },
  {
    id: "04",
    name: "Stair-step pixels",
    eyes: "Diagonal 8-bit steps",
    color: "orange",
  },
  {
    id: "05",
    name: "Chevrons",
    eyes: "Pixel > < corners",
    color: "purple",
  },
  {
    id: "06",
    name: "1x3 horizontal bars",
    eyes: "Triple segmented micro-dots",
    color: "blue",
  },
  {
    id: "07",
    name: "Slanted ticks",
    eyes: "Slight focused squint",
    color: "green",
  },
  {
    id: "08",
    name: "Plus clusters",
    eyes: "+ reticle crosses",
    color: "orange",
  },
] as const;

export type AvatarId = (typeof AGENT_AVATARS)[number]["id"];

export function isAvatarId(value: string): value is AvatarId {
  return AGENT_AVATARS.some((avatar) => avatar.id === value);
}
