"use client";

import {
  splitDeskSkillTokens,
  type DeskSkillTextSegment,
} from "@squadrons/shared";

function SkillTokenSegments({
  segments,
  skillClassName,
}: {
  segments: DeskSkillTextSegment[];
  skillClassName: string;
}) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "skill" ? (
          <span key={`${segment.name}-${index}`} className={skillClassName}>
            {segment.value}
          </span>
        ) : (
          <span key={`t-${index}`}>{segment.value}</span>
        ),
      )}
    </>
  );
}

/** Render message / prompt text with recognized `/skill` tokens accented. */
export function SkillHighlightedText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const segments = splitDeskSkillTokens(text);
  return (
    <span className={className}>
      <SkillTokenSegments
        segments={segments}
        skillClassName="font-medium text-[var(--accent)]"
      />
    </span>
  );
}

/**
 * Mirror layer for a transparent textarea — paints `/skill` tokens in accent
 * while caret/selection stay on the real input (Cursor-style).
 */
export function SkillComposerBackdrop({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const segments = splitDeskSkillTokens(value);
  return (
    <div
      aria-hidden
      className={`pointer-events-none whitespace-pre-wrap break-words text-[var(--ink)] ${className}`}
    >
      <SkillTokenSegments
        segments={segments}
        skillClassName="font-medium text-[var(--accent)]"
      />
      {/* Trailing newline keeps height in sync when value ends with \n */}
      {value.endsWith("\n") ? "\n" : null}
    </div>
  );
}
