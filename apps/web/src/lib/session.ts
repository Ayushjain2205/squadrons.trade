const SESSION_KEY = "squadrons:session";

export function markSquadronsSession(): void {
  try {
    window.localStorage.setItem(SESSION_KEY, "1");
  } catch {
    // private mode
  }
}

export function clearSquadronsSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // private mode
  }
}

export function hasSquadronsSession(): boolean {
  try {
    return window.localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
