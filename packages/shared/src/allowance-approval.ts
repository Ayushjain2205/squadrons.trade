/** Marker embedded in system chat messages for allowance approval cards. */
export const ALLOWANCE_APPROVAL_MARKER_PREFIX =
  "[[squadrons:allowance_approval:";

export function allowanceApprovalMarker(intentId: string): string {
  return `${ALLOWANCE_APPROVAL_MARKER_PREFIX}${intentId}]]`;
}

export function parseAllowanceApprovalMarker(
  content: string,
): string | null {
  const match = content.match(
    /\[\[squadrons:allowance_approval:([0-9a-fA-F-]{36})\]\]/,
  );
  return match?.[1] ?? null;
}

export function stripAllowanceApprovalMarker(content: string): string {
  return content
    .replace(/\[\[squadrons:allowance_approval:[0-9a-fA-F-]{36}\]\]/g, "")
    .trim();
}
