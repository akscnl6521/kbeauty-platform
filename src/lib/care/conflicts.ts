/**
 * Routine product conflict heuristics (general cautions only).
 */

import type { CareRoutineItem } from "@/lib/care/types";

const RETINOID =
  /retinol|retinoid|retinal|tretinoin|adapalene|레티놀|레티노이드/i;
const ACID = /\b(aha|bha|pha|glycolic|salicylic|lactic|mandelic)\b|각질|필링/i;
const FRAGRANCE = /fragrance|parfum|향료|perfume/i;

export function detectRoutineConflicts(
  items: CareRoutineItem[],
  allergy: string[] = [],
  avoided: string[] = []
): string[] {
  const notes: string[] = [];
  const active = items.filter((i) => i.active);
  const labels = active.map(
    (i) => `${i.customProductName ?? ""} ${i.step} ${i.usageNote ?? ""}`
  );
  const hay = labels.join(" ").toLowerCase();

  const hasRetinoid = RETINOID.test(hay) || active.some((i) => i.step === "treatment");
  const hasExfoliant =
    ACID.test(hay) || active.some((i) => i.step === "exfoliant");
  if (hasRetinoid && hasExfoliant) {
    notes.push(
      "레티노이드계와 강한 각질 케어를 같은 날에 쓰기 부담스러울 수 있습니다. 빈도를 조절해 보세요."
    );
  }

  const acidSteps = active.filter(
    (i) => i.step === "exfoliant" || ACID.test(i.customProductName ?? "")
  );
  if (acidSteps.length >= 2) {
    notes.push("산 성분이 중복될 수 있습니다. 하나를 줄이는 것을 권장합니다.");
  }

  for (const item of active) {
    const name = (item.customProductName ?? "").toLowerCase();
    for (const a of [...allergy, ...avoided]) {
      const key = a.trim().toLowerCase();
      if (key && name.includes(key)) {
        notes.push(`회피/알레르기 가능 성분과 충돌 의심: ${a}`);
        item.allergyConflict = true;
      }
    }
  }

  if (FRAGRANCE.test(hay) && allergy.some((a) => /향|fragrance|perfume/i.test(a))) {
    notes.push("향료 민감 보고와 향 포함 제품이 함께 있습니다.");
  }

  return [...new Set(notes)];
}
