/**
 * Strip infra noise from assistant chat so the desk stays operator-facing.
 * Strategy/tick authorship belongs in tools + the right rail, not code fences.
 */
export function sanitizeAssistantContent(content: string): string {
  return content
    .replace(/```strategy\s*[\s\S]*?```/gi, "")
    .replace(/```tick\s*[\s\S]*?```/gi, "")
    .replace(
      /```(?:json)?\s*\{[\s\S]*?"(?:summary|trigger|action|label)"[\s\S]*?\}\s*```/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
