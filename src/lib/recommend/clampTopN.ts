/**
 * Never invent filler products to reach Top N.
 */
export function clampTopNWithoutPadding<T>(items: T[], topN: number): T[] {
  if (topN < 1) return [];
  return items.slice(0, Math.min(topN, items.length));
}
