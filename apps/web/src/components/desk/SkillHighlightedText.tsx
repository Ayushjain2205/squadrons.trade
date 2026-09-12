"use client";

import {
  splitComposerTokens,
  type DeskSkillTextSegment,
} from "@squadrons/shared";

function ComposerTokenSegments({
  segments,
}: {
  segments: DeskSkillTextSegment[];
}) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "skill") {
          return (
            <span
              key={`skill-${segment.name}-${index}`}
              className="font-medium text-[var(--accent)]"
            >
              {segment.value}
            </span>
          );
        }
        if (segment.kind === "plugin") {
          return (
            <span
              key={`plugin-${segment.name}-${index}`}
              className="font-medium text-[var(--link)]"
            >
              {segment.value}
            </span>
          );
        }
        return <span key={`t-${index}`}>{segment.value}</span>;
      })}
    </>
  );
}

/** Render message / prompt text with `/skill` and `@plugin` tokens accented. */
export function SkillHighlightedText({
  text,
  pluginServerNames = [],
  className = "",
}: {
  text: string;
  pluginServerNames?: Iterable<string>;
  className?: string;
}) {
  const segments = splitComposerTokens(text, pluginServerNames);
  return (
    <span className={className}>
      <ComposerTokenSegments segments={segments} />
    </span>
  );
}

/**
 * Mirror layer for a transparent textarea — paints `/skill` + `@plugin` tokens
 * while caret/selection stay on the real input (Cursor-style).
 */
export function SkillComposerBackdrop({
  value,
  pluginServerNames = [],
  className = "",
}: {
  value: string;
  pluginServerNames?: Iterable<string>;
  className?: string;
}) {
  const segments = splitComposerTokens(value, pluginServerNames);
  return (
    <div
      aria-hidden
      className={`pointer-events-none whitespace-pre-wrap break-words text-[var(--ink)] ${className}`}
    >
      <ComposerTokenSegments segments={segments} />
      {value.endsWith("\n") ? "\n" : null}
    </div>
  );
}
