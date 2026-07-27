/**
 * Accessibility audit for the four admin review screens:
 *   /admin/usage-guides · /admin/usage-guides/[id]
 *   /admin/media-review · /admin/media-review/[id]
 *
 * Two halves:
 *   1. every colour pair those screens actually render, checked against WCAG AA
 *   2. static markup rules that catch the mistakes this audit found —
 *      colour-only status, unscoped table headers, unlabelled scroll regions,
 *      and form errors not wired to their field
 *
 * Offline: reads the source files, no DOM, no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contrastRatio,
  formatRatio,
  meetsAA,
  meetsNonTextAA,
} from "../src/lib/a11y/contrast";

/**
 * Values read out of the built stylesheet (.next/static/chunks/*.css) rather
 * than copied from Tailwind docs — v4 ships its own palette and these are what
 * the browser actually paints.
 */
const C = {
  white: "#ffffff",
  paper: "#FAF7F5", // page background
  card: "#ffffff",
  tableHead: "#F7F1EC",
  excerpt: "#FBF8F6",
  brand: "#8B6914",
  red50: "#fef2f2",
  red200: "#ffcaca",
  red800: "#9f0712",
  red900: "#82181a",
  emerald50: "#ecfdf5",
  emerald200: "#a4f4cf",
  emerald800: "#005f46",
  emerald900: "#004e3b",
  amber50: "#fffbeb",
  amber200: "#fee685",
  amber800: "#953d00",
  amber900: "#7b3306",
  gray400: "#99a1af",
  gray500: "#6a7282",
  gray600: "#4a5565",
  gray700: "#364153",
  gray800: "#1e2939",
  gray900: "#101828",
  border: "#E8DFD8",
} as const;

type Pair = {
  label: string;
  fg: string;
  bg: string;
  size?: "normal" | "large";
  /** non-text (icon/border) uses the 3:1 rule */
  nonText?: boolean;
};

const PAIRS: Pair[] = [
  // page + card body text
  { label: "gray-900 on paper", fg: C.gray900, bg: C.paper },
  { label: "gray-900 on card", fg: C.gray900, bg: C.card },
  { label: "gray-800 on card", fg: C.gray800, bg: C.card },
  { label: "gray-700 on card", fg: C.gray700, bg: C.card },
  { label: "gray-600 on paper", fg: C.gray600, bg: C.paper },
  { label: "gray-600 on card", fg: C.gray600, bg: C.card },
  { label: "gray-500 (meta text) on card", fg: C.gray500, bg: C.card },
  { label: "gray-500 (meta text) on paper", fg: C.gray500, bg: C.paper },
  { label: "gray-600 on table head", fg: C.gray600, bg: C.tableHead },
  { label: "gray-800 on source excerpt", fg: C.gray800, bg: C.excerpt },

  // brand link + button
  { label: "brand link on card", fg: C.brand, bg: C.card },
  { label: "brand link on paper", fg: C.brand, bg: C.paper },
  { label: "white on brand button", fg: C.white, bg: C.brand },

  // status surfaces
  { label: "red-800 on red-50 (blocking reasons)", fg: C.red800, bg: C.red50 },
  { label: "red-900 on red-50 (blocked banner)", fg: C.red900, bg: C.red50 },
  { label: "red-800 on card (row-level reasons)", fg: C.red800, bg: C.card },
  {
    label: "emerald-800 on emerald-50 (pass pill)",
    fg: C.emerald800,
    bg: C.emerald50,
  },
  {
    label: "emerald-900 on emerald-50 (ok banner)",
    fg: C.emerald900,
    bg: C.emerald50,
  },
  { label: "emerald-800 on card (checklist pass)", fg: C.emerald800, bg: C.card },
  { label: "amber-900 on amber-50 (schema notice)", fg: C.amber900, bg: C.amber50 },
  { label: "amber-800 on card (mismatch warning)", fg: C.amber800, bg: C.card },

];

/**
 * The 200-level borders around status banners and pills sit at roughly 1.3:1
 * against white, well under the 3:1 that WCAG 1.4.11 asks of a control's visual
 * boundary. They are exempt because they are not the boundary of a control and
 * not the state indicator: every surface they wrap also states its condition in
 * words ("아직 승인할 수 없습니다", "통과"/"미충족"). Darkening them would change
 * the visual language for no accessibility gain — but the exemption only holds
 * while the text is really there, which the markup rules below enforce.
 */
const DECORATIVE_BORDERS = [
  { label: "red-200 border", fg: C.red200 },
  { label: "emerald-200 border", fg: C.emerald200 },
  { label: "amber-200 border", fg: C.amber200 },
];

console.log("[a11y] 1. colour contrast (WCAG 2.1 AA)");
let contrastFailures = 0;
for (const pair of PAIRS) {
  const ok = pair.nonText
    ? meetsNonTextAA(pair.fg, pair.bg)
    : meetsAA(pair.fg, pair.bg, pair.size ?? "normal");
  const need = pair.nonText ? "3:1" : pair.size === "large" ? "3:1" : "4.5:1";
  const line = `${pair.label.padEnd(42)} ${formatRatio(pair.fg, pair.bg).padStart(7)}  need ${need}`;
  if (ok) {
    console.log(`  ok   ${line}`);
  } else {
    contrastFailures += 1;
    console.error(`  FAIL ${line}`);
  }
}
assert.equal(
  contrastFailures,
  0,
  `${contrastFailures} colour pair(s) below WCAG AA`
);

for (const border of DECORATIVE_BORDERS) {
  console.log(
    `  --   ${border.label.padEnd(42)} ${formatRatio(border.fg, C.card).padStart(7)}  decorative (state is in text)`
  );
  assert.ok(
    contrastRatio(border.fg, C.card) < 3,
    `${border.label} is below 3:1, so it is only allowed as decoration`
  );
}

// gray-400 is used only for disabled radio labels and em-dash placeholders.
// It fails AA on purpose-built surfaces, so it must never carry information.
assert.ok(
  !meetsAA(C.gray400, C.card),
  "gray-400 is genuinely low contrast — it must stay decorative"
);

// --- 2. markup rules --------------------------------------------------------
console.log("");
console.log("[a11y] 2. markup");

const FILES = {
  guidesList: "src/app/admin/usage-guides/page.tsx",
  guidesDetail: "src/app/admin/usage-guides/[id]/page.tsx",
  guidesPanel: "src/app/admin/usage-guides/UsageGuideDecisionPanel.tsx",
  mediaList: "src/app/admin/media-review/page.tsx",
  mediaDetail: "src/app/admin/media-review/[id]/page.tsx",
  mediaPanel: "src/app/admin/media-review/MediaReviewDecisionPanel.tsx",
} as const;

const src = Object.fromEntries(
  Object.entries(FILES).map(([key, file]) => [key, readFileSync(file, "utf8")])
) as Record<keyof typeof FILES, string>;

let markupFailures = 0;
function check(condition: unknown, label: string) {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  markupFailures += 1;
  console.error(`  FAIL ${label}`);
}

// 1.4.1 Use of Colour — status must not rely on colour alone
for (const key of ["mediaList", "mediaDetail", "guidesList", "guidesDetail"] as const) {
  const text = src[key];
  const colourClassCount = (text.match(/text-(red|emerald|amber)-\d00/g) ?? []).length;
  if (colourClassCount === 0) continue;
  check(
    /StatusMark|srOnly|sr-only|aria-label=/.test(text),
    `${FILES[key]}: status carries a non-colour cue`
  );
}

// The written state now lives in the shared marker component, so assert it at
// the source and assert that the screens actually route their status through it.
const statusMark = readFileSync("src/components/admin/StatusMark.tsx", "utf8");
check(
  /sr-only/.test(statusMark) &&
    /통과/.test(statusMark) &&
    /미충족/.test(statusMark) &&
    /확인 필요/.test(statusMark),
  "StatusMark exposes a written state (통과 / 미충족 / 확인 필요) to screen readers"
);
check(
  /aria-hidden="true"/.test(statusMark),
  "the glyph is aria-hidden so the state is not announced twice"
);
for (const key of ["mediaList", "mediaDetail", "guidesList"] as const) {
  check(
    /StatusPill|StatusText/.test(src[key]),
    `${FILES[key]}: status is rendered through the shared marker, not raw colour`
  );
}
check(
  !/\{ok \? "✓" : "✕"\}\s*\{label\}/.test(src.mediaList),
  "the pass/fail pill no longer relies on a bare glyph plus colour"
);

// 1.3.1 Info and Relationships — table headers must be scoped
for (const key of ["guidesList", "mediaList"] as const) {
  const headerCount = (src[key].match(/<th\b/g) ?? []).length;
  const scopedCount = (src[key].match(/<th[^>]*scope="col"/g) ?? []).length;
  check(
    headerCount > 0 && headerCount === scopedCount,
    `${FILES[key]}: all ${headerCount} column headers use scope="col" (${scopedCount} scoped)`
  );
}

// 2.1.1 Keyboard — scrollable regions must be reachable
for (const key of ["guidesList", "mediaList"] as const) {
  check(
    /overflow-x-auto[\s\S]{0,200}tabIndex=\{0\}/.test(src[key]) ||
      /tabIndex=\{0\}[\s\S]{0,200}overflow-x-auto/.test(src[key]),
    `${FILES[key]}: the horizontally scrolling table is keyboard reachable`
  );
}
check(
  /overflow-auto[\s\S]{0,240}tabIndex=\{0\}/.test(src.guidesDetail) ||
    /tabIndex=\{0\}[\s\S]{0,240}overflow-auto/.test(src.guidesDetail),
  `${FILES.guidesDetail}: the scrollable source excerpt is keyboard reachable`
);

// 3.3.1 / 3.3.3 Error identification — the message must be tied to the field
for (const key of ["guidesPanel", "mediaPanel"] as const) {
  check(
    /aria-describedby=/.test(src[key]),
    `${FILES[key]}: the note field is described by the status message`
  );
  check(
    /role=\{[^}]*"alert"[^}]*\}|role="alert"/.test(src[key]),
    `${FILES[key]}: errors announce as an alert, not a polite status`
  );
  check(
    /aria-invalid=/.test(src[key]),
    `${FILES[key]}: the note field is marked invalid when the server rejects it`
  );
  check(
    /aria-busy=|disabled=\{pending\}/.test(src[key]),
    `${FILES[key]}: submit state is exposed while pending`
  );
}

// 4.1.2 Name, Role, Value — the disabled approve option needs a reason
for (const key of ["guidesPanel", "mediaPanel"] as const) {
  check(
    /aria-describedby=\{disabled/.test(src[key]) ||
      /disabled[\s\S]{0,300}aria-describedby/.test(src[key]),
    `${FILES[key]}: the disabled approve option explains why it is disabled`
  );
}

// 2.4.6 Headings — each screen has exactly one h1
for (const key of Object.keys(FILES) as (keyof typeof FILES)[]) {
  const h1 = (src[key].match(/<h1\b/g) ?? []).length;
  if (key.endsWith("Panel")) {
    check(h1 === 0, `${FILES[key]}: panel contributes no h1`);
  } else {
    check(h1 === 1, `${FILES[key]}: exactly one h1 (found ${h1})`);
  }
}

assert.equal(markupFailures, 0, `${markupFailures} markup rule(s) failed`);

console.log("");
console.log("[admin-review-a11y] self-test: ok");
