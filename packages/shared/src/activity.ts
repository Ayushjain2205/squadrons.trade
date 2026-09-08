/** Abstracted activity verbs — never expose tool ids in the UI. */
export const ACTIVITY_STEP_LABELS: Record<string, string> = {
  get_wallet_balances: "Looking up balances",
  get_spot_prices: "Checking prices",
  web_search: "Searching the web",
  WebSearch: "Searching the web",
  web_fetch: "Reading a page",
  todo_write: "Organizing next steps",
  todo_read: "Reviewing next steps",
  ask_user_question: "Needs your input",
  skill: "Using a playbook",
};

/** Legacy labels written before abstraction — map to the current verb. */
const LEGACY_LABELS: Record<string, string> = {
  "Checking wallet balances": "Looking up balances",
  "Checking wallet balances · done": "Looking up balances",
  "Fetching spot prices": "Checking prices",
  "Fetching spot prices · done": "Checking prices",
  "Searching the web · done": "Searching the web",
  "Paused by you": "Stopped",
  "Turn failed": "Something went wrong",
  "Turn ended with an error": "Something went wrong",
  "Working…": "Working on it",
  "Turn finished": "", // hide
};

export function activityStepLabel(toolName: string): string {
  return ACTIVITY_STEP_LABELS[toolName] ?? "Working on it";
}

/**
 * Canonical display text for a stored activity row (handles legacy copy).
 * Returns null when the row should be hidden entirely.
 */
export function displayActivityLabel(event: {
  kind: string;
  label: string;
  toolName?: string | null;
}): string | null {
  if (event.kind === "turn_start" || event.kind === "turn_end") return null;
  if (event.kind === "tool_result") return null;

  if (event.toolName) {
    const known = ACTIVITY_STEP_LABELS[event.toolName];
    if (known) {
      return event.kind === "error" ? `${known} failed` : known;
    }
  }

  const trimmed = event.label.trim();
  if (trimmed in LEGACY_LABELS) {
    const mapped = LEGACY_LABELS[trimmed] ?? "";
    return mapped.length > 0 ? mapped : null;
  }

  // Hide "X · done" leftovers even if wording drifts.
  if (/·\s*done$/i.test(trimmed)) return null;

  return trimmed;
}
