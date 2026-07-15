/** Conservative INCI-looking list check — never invent tokens. */
export function looksLikeInciListText(text: string): boolean {
  const parts = text
    .split(/[,;،·•|/]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length < 5) return false;
  const latin = parts.filter((p) => /[A-Za-z]/.test(p)).length;
  if (latin / parts.length < 0.55) return false;
  const joined = text.toLowerCase();
  // Reject marketing blurbs
  if (
    /mixed flavors|product cream base|see packaging|ingredient list unavailable/i.test(
      joined
    )
  ) {
    return false;
  }
  const hasVehicle =
    /\b(aqua|water|정제수|glycerin|butylene\s+glycol|caprylic|propanediol)\b/i.test(
      joined
    );
  return hasVehicle;
}
