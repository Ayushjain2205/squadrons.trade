/** Present-tense verbs while a step is in flight. */
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

/** Past-tense verbs once the step has finished. */
export const ACTIVITY_STEP_LABELS_DONE: Record<string, string> = {
  get_wallet_balances: "Looked up balances",
  get_spot_prices: "Checked prices",
  web_search: "Searched the web",
  WebSearch: "Searched the web",
  web_fetch: "Read a page",
  todo_write: "Organized next steps",
  todo_read: "Reviewed next steps",
  ask_user_question: "Asked for input",
  skill: "Used a playbook",
};

/** Legacy labels written before abstraction — map to the current present verb. */
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

const PRESENT_TO_PAST: Record<string, string> = {
  "Looking up balances": "Looked up balances",
  "Checking prices": "Checked prices",
  "Searching the web": "Searched the web",
  "Reading a page": "Read a page",
  "Organizing next steps": "Organized next steps",
  "Reviewing next steps": "Reviewed next steps",
  "Needs your input": "Asked for input",
  "Using a playbook": "Used a playbook",
  "Working on it": "Finished a step",
};

export function activityStepLabel(toolName: string): string {
  return ACTIVITY_STEP_LABELS[toolName] ?? "Working on it";
}

function pastVerb(present: string, toolName?: string | null): string {
  if (toolName && ACTIVITY_STEP_LABELS_DONE[toolName]) {
    return ACTIVITY_STEP_LABELS_DONE[toolName]!;
  }
  return PRESENT_TO_PAST[present] ?? present;
}

/**
 * Canonical display text for a stored activity row (handles legacy copy).
 * Returns null when the row should be hidden entirely.
 * Pass `done: true` for past tense after the step has finished.
 */
export function displayActivityLabel(
  event: {
    kind: string;
    label: string;
    toolName?: string | null;
  },
  options: { done?: boolean } = {},
): string | null {
  if (event.kind === "turn_start" || event.kind === "turn_end") return null;
  if (event.kind === "tool_result") return null;

  const done = Boolean(options.done);
  const trimmed = event.label.trim();
  if (/·\s*done$/i.test(trimmed)) return null;

  // Resolve a present-tense base label first.
  let present: string | null = null;
  if (event.toolName && ACTIVITY_STEP_LABELS[event.toolName]) {
    present = ACTIVITY_STEP_LABELS[event.toolName]!;
  } else if (trimmed in LEGACY_LABELS) {
    const mapped = LEGACY_LABELS[trimmed] ?? "";
    present = mapped.length > 0 ? mapped : null;
  } else if (trimmed.length > 0) {
    present = trimmed;
  }

  if (!present) return null;

  if (event.kind === "error") {
    // Prefer past on completed errors: "Looked up balances failed" is awkward —
    // keep a short fixed failure line when tool-known, else the stored label.
    if (event.toolName && ACTIVITY_STEP_LABELS[event.toolName]) {
      return `${ACTIVITY_STEP_LABELS[event.toolName]} failed`;
    }
    return present;
  }

  if (event.kind === "info") return present;

  return done ? pastVerb(present, event.toolName) : present;
}
