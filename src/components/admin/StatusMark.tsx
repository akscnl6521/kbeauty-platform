import type { ReactNode } from "react";

/**
 * A pass / fail / warning marker for the review screens.
 *
 * WCAG 1.4.1: colour must not be the only way a state is conveyed. Every marker
 * therefore carries three cues — a shape (✓ ✕ !), a written state word, and the
 * colour. The state word is visually hidden because sighted reviewers read the
 * shape faster in a dense table, but it is present for screen readers and it is
 * what a colour-blind reviewer's browser reads aloud.
 *
 * The glyph itself is aria-hidden so the row is not announced as
 * "check mark 공식 출처 통과" — the shape is decoration once the word is there.
 */

export type StatusState = "pass" | "fail" | "warn";

const GLYPH: Record<StatusState, string> = {
  pass: "✓",
  fail: "✕",
  warn: "!",
};

/** Written state, read aloud in place of the glyph. */
const STATE_LABEL: Record<StatusState, string> = {
  pass: "통과",
  fail: "미충족",
  warn: "확인 필요",
};

const PILL_CLASS: Record<StatusState, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  fail: "border-red-200 bg-red-50 text-red-800",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
};

const TEXT_CLASS: Record<StatusState, string> = {
  pass: "text-emerald-800",
  fail: "text-red-800",
  warn: "text-amber-800",
};

export function StatusGlyph({ state }: { state: StatusState }) {
  return (
    <>
      <span aria-hidden="true">{GLYPH[state]}</span>
      <span className="sr-only">{STATE_LABEL[state]}</span>
    </>
  );
}

/** Compact badge for table cells. */
export function StatusPill({
  state,
  children,
}: {
  state: StatusState;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${PILL_CLASS[state]}`}
    >
      <StatusGlyph state={state} />
      {children}
    </span>
  );
}

/** Inline status line, e.g. a checklist item or a row-level note. */
export function StatusText({
  state,
  children,
  className = "",
}: {
  state: StatusState;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`${TEXT_CLASS[state]} ${className}`.trim()}>
      <StatusGlyph state={state} /> {children}
    </span>
  );
}
