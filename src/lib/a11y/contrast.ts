/**
 * WCAG 2.1 contrast maths. Pure — no DOM, no network.
 *
 * Used to audit the admin review screens rather than eyeballing them: a colour
 * pair either clears the threshold or it does not, and the number says which.
 */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG relative luminance (sRGB). */
export function relativeLuminance(color: Rgb): number {
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

/** Contrast ratio between two colours, 1–21. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(hexToRgb(foreground));
  const l2 = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type TextSize = "normal" | "large";

/**
 * WCAG 2.1 AA thresholds. "large" means >= 24px, or >= 18.66px when bold —
 * anything smaller must clear 4.5:1.
 */
export function requiredRatio(size: TextSize): number {
  return size === "large" ? 3 : 4.5;
}

export function meetsAA(
  foreground: string,
  background: string,
  size: TextSize = "normal"
): boolean {
  // rounded to 2dp first so a value that displays as 4.50 is not failed by float noise
  const ratio = Math.round(contrastRatio(foreground, background) * 100) / 100;
  return ratio >= requiredRatio(size);
}

/** Non-text contrast (icons, borders, focus rings) needs 3:1 — WCAG 1.4.11. */
export function meetsNonTextAA(foreground: string, background: string): boolean {
  return Math.round(contrastRatio(foreground, background) * 100) / 100 >= 3;
}

export function formatRatio(foreground: string, background: string): string {
  return `${contrastRatio(foreground, background).toFixed(2)}:1`;
}
