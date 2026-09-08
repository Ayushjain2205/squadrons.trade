/** Fixed orb face styles (eye shapes). Color is chosen separately. */
export const AGENT_FACES = [
  {
    id: "01",
    name: "Slit bars",
    eyes: "Horizontal laser dashes",
  },
  {
    id: "02",
    name: "Vertical pills",
    eyes: "Tall vertical columns",
  },
  {
    id: "03",
    name: "Hollow frames",
    eyes: "Outline square boxes",
  },
  {
    id: "04",
    name: "Stair-step pixels",
    eyes: "Diagonal 8-bit steps",
  },
  {
    id: "05",
    name: "Chevrons",
    eyes: "Pixel > < corners",
  },
  {
    id: "06",
    name: "1x3 horizontal bars",
    eyes: "Triple segmented micro-dots",
  },
  {
    id: "07",
    name: "Slanted ticks",
    eyes: "Slight focused squint",
  },
  {
    id: "08",
    name: "Plus clusters",
    eyes: "+ reticle crosses",
  },
] as const;

/** Orb body / eye palette — independent of face. */
export const AGENT_COLORS = [
  {
    id: "purple",
    name: "Purple",
    orb: "#6B5B95",
    eye: "#C4B5FD",
    gloss: "#9B8BC4",
    shade: "#4A3F6A",
  },
  {
    id: "blue",
    name: "Blue",
    orb: "#3D6B9A",
    eye: "#93C5FD",
    gloss: "#6B9BC4",
    shade: "#2A4A6C",
  },
  {
    id: "green",
    name: "Green",
    orb: "#3D7A5A",
    eye: "#86EFAC",
    gloss: "#5A9A7A",
    shade: "#2A5440",
  },
  {
    id: "yellow",
    name: "Yellow",
    orb: "#9A8A3D",
    eye: "#FDE68A",
    gloss: "#C4B46B",
    shade: "#6A5E2A",
  },
  {
    id: "orange",
    name: "Orange",
    orb: "#9A6B3D",
    eye: "#FCD34D",
    gloss: "#C49A6B",
    shade: "#6A4A2A",
  },
  {
    id: "red",
    name: "Red",
    orb: "#8B4545",
    eye: "#FCA5A5",
    gloss: "#B56B6B",
    shade: "#5C3030",
  },
  {
    id: "pink",
    name: "Pink",
    orb: "#8B4A6B",
    eye: "#F9A8D4",
    gloss: "#B56B8B",
    shade: "#5C3248",
  },
] as const;

/** @deprecated Prefer AGENT_FACES — kept as alias for older imports. */
export const AGENT_AVATARS = AGENT_FACES;

export type AvatarId = (typeof AGENT_FACES)[number]["id"];
export type FaceId = AvatarId;
export type OrbColorId = (typeof AGENT_COLORS)[number]["id"];

export const DEFAULT_ORB_COLOR: OrbColorId = "purple";

/** Legacy face→color pairing used before colors were independent. */
const LEGACY_FACE_COLORS: Record<AvatarId, OrbColorId> = {
  "01": "purple",
  "02": "blue",
  "03": "green",
  "04": "orange",
  "05": "purple",
  "06": "blue",
  "07": "green",
  "08": "orange",
};

export function isAvatarId(value: string): value is AvatarId {
  return AGENT_FACES.some((face) => face.id === value);
}

export function isFaceId(value: string): value is FaceId {
  return isAvatarId(value);
}

export function isOrbColorId(value: string): value is OrbColorId {
  return AGENT_COLORS.some((color) => color.id === value);
}

export function getOrbColor(id: OrbColorId) {
  return AGENT_COLORS.find((color) => color.id === id)!;
}

export function legacyColorForFace(faceId: AvatarId): OrbColorId {
  return LEGACY_FACE_COLORS[faceId] ?? DEFAULT_ORB_COLOR;
}
