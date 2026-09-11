/** Present-tense verbs while a step is in flight. */
export const ACTIVITY_STEP_LABELS: Record<string, string> = {
  get_wallet_balances: "Looking up balances",
  get_spot_prices: "Checking prices",
  propose_strategy: "Drafting strategy",
  update_strategy_params: "Updating strategy params",
  propose_improvement: "Suggesting self-improvement",
  get_strategy: "Checking strategy",
  search_x: "Searching X",
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
  propose_strategy: "Drafted strategy",
  update_strategy_params: "Updated strategy params",
  propose_improvement: "Suggested self-improvement",
  get_strategy: "Checked strategy",
  search_x: "Searched X",
  web_search: "Searched the web",
  WebSearch: "Searched the web",
  web_fetch: "Read a page",
  todo_write: "Organized next steps",
  todo_read: "Reviewed next steps",
  ask_user_question: "Asked for input",
  skill: "Used a playbook",
};

export function activityStepLabel(toolName: string): string {
  return ACTIVITY_STEP_LABELS[toolName] ?? "Working on it";
}

export function activityStepLabelDone(toolName: string): string {
  return ACTIVITY_STEP_LABELS_DONE[toolName] ?? "Finished a step";
}

/**
 * Display text for an activity row.
 * Prefer toolName → verb maps; otherwise use the stored label.
 * `done` switches known tools to past tense.
 */
export function displayActivityLabel(
  event: {
    kind: string;
    label: string;
    toolName?: string | null;
  },
  options: { done?: boolean } = {},
): string | null {
  if (
    event.kind === "turn_start" ||
    event.kind === "turn_end" ||
    event.kind === "tool_result"
  ) {
    return null;
  }

  const done = Boolean(options.done);

  if (event.kind === "error") {
    if (event.toolName && ACTIVITY_STEP_LABELS[event.toolName]) {
      return `${ACTIVITY_STEP_LABELS[event.toolName]} failed`;
    }
    return event.label || null;
  }

  if (event.kind === "info") return event.label || null;

  if (event.toolName) {
    return done
      ? activityStepLabelDone(event.toolName)
      : activityStepLabel(event.toolName);
  }

  return event.label || null;
}
