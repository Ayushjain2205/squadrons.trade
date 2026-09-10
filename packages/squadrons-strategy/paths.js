// Keep in sync with apps/host strategy workspace helpers.
export const STRATEGY_DIR = ".squadrons";
export const STRATEGY_DRAFT_FILE = "strategy-draft.json";
export const STRATEGY_STATE_FILE = "strategy-state.json";
export const STRATEGY_PARAMS_PATCH_FILE = "strategy-params-patch.json";
export const STRATEGY_IMPROVEMENT_FILE = "strategy-improvement.json";

export function draftPath(cwd = process.cwd()) {
  return `${cwd}/${STRATEGY_DIR}/${STRATEGY_DRAFT_FILE}`;
}

export function statePath(cwd = process.cwd()) {
  return `${cwd}/${STRATEGY_DIR}/${STRATEGY_STATE_FILE}`;
}

export function paramsPatchPath(cwd = process.cwd()) {
  return `${cwd}/${STRATEGY_DIR}/${STRATEGY_PARAMS_PATCH_FILE}`;
}

export function improvementPath(cwd = process.cwd()) {
  return `${cwd}/${STRATEGY_DIR}/${STRATEGY_IMPROVEMENT_FILE}`;
}
