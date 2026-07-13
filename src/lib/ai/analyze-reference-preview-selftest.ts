import {
  buildAnalyzeReferencePreview,
  type CurrentAnalyzeInput,
} from "./analyzeReferencePreview";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[analyze-reference-preview] ${msg}`);
}

function assertNoDiseaseNames(text: string) {
  const banned = ["주사병", "rosacea", "아토피 피부염", "치료합니다", "완치"];
  for (const b of banned) {
    assert(!text.toLowerCase().includes(b.toLowerCase()), `no disease: ${b}`);
  }
}

export function runAnalyzeReferencePreviewSelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;
  const baseTone: CurrentAnalyzeInput = {
    skinTone: "중간",
    undertone: "중립",
    concerns: ["건조함"],
    sensitivity: "보통",
  };

  // 1. 건조함 → 보습 성분
  const dry = buildAnalyzeReferencePreview(baseTone);
  assert(dry.kind === "reference_preview", "kind");
  assert(
    dry.ingredients.some(
      (i) =>
        i.includes("히알루론") ||
        i.includes("세라마이드") ||
        i.includes("판테놀") ||
        i.includes("글리세린")
    ),
    "dryness moisturizing ingredients"
  );
  checks += 1;

  // 2. 붉은기 → 진정·장벽
  const red = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["붉은기"],
  });
  assert(
    red.ingredients.some(
      (i) =>
        i.includes("센텔라") ||
        i.includes("시카") ||
        i.includes("판테놀") ||
        i.includes("알란토인")
    ),
    "redness calm/barrier"
  );
  checks += 1;

  // 3. 건조함 + 붉은기 → canonical dedupe (판테놀·세라마이드 중복 제거)
  const both = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["건조함", "붉은기"],
  });
  assert(both.ingredients.length <= 6, "max 6 ingredients");
  const panthenolHits = both.ingredients.filter((i) => i.includes("판테놀"));
  assert(panthenolHits.length <= 1, "panthenol deduped");
  checks += 1;

  // 4. 건조함 → 칙칙함 변경 시 성분 변경
  const dull = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["칙칙함"],
  });
  assert(
    JSON.stringify(dry.ingredients) !== JSON.stringify(dull.ingredients),
    "concern change updates ingredients"
  );
  assert(
    dull.ingredients.some((i) => i.includes("나이아신") || i.includes("알부틴")),
    "dullness ingredients"
  );
  checks += 1;

  // 5. 민감도 높음 + 여드름 → Salicylic 주의
  const acneSensitive = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["여드름"],
    sensitivity: "민감함",
  });
  assert(
    !acneSensitive.ingredients.some((i) =>
      /살리실|salicylic/i.test(i)
    ),
    "salicylic removed from primary when sensitive"
  );
  assert(
    acneSensitive.cautionIngredients.some((i) =>
      /살리실|salicylic/i.test(i)
    ) || acneSensitive.avoidHints.some((h) => h.includes("각질")),
    "salicylic caution or avoid"
  );
  checks += 1;

  // 6. 민감도 높음 + 노화방지 → Retinoid 주의
  const ageSensitive = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["노화방지"],
    sensitivity: "민감함",
  });
  assert(
    !ageSensitive.ingredients.some((i) => /레티노|retinoid/i.test(i)),
    "retinoid removed from primary when sensitive"
  );
  assert(
    ageSensitive.cautionIngredients.some((i) => /레티노|retinoid/i.test(i)) ||
      ageSensitive.avoidHints.some((h) => h.includes("레티노")),
    "retinoid caution"
  );
  checks += 1;

  // 7. 피부톤/언더톤 변경 → 성분 배열 불변
  const toneA = buildAnalyzeReferencePreview({
    ...baseTone,
    skinTone: "밝은",
    undertone: "웜톤",
  });
  const toneB = buildAnalyzeReferencePreview({
    ...baseTone,
    skinTone: "어두운",
    undertone: "쿨톤",
  });
  assert(
    JSON.stringify(toneA.ingredients) === JSON.stringify(toneB.ingredients),
    "tone/undertone do not change ingredients"
  );
  assert(toneA.toneNote_ko.includes("색조"), "tone note present");
  checks += 1;

  // 8. persistent + burning → 상담 고려
  const counsel = buildAnalyzeReferencePreview({
    ...baseTone,
    concerns: ["붉은기"],
    rednessObservation: {
      duration: "persistent",
      symptoms: ["burning"],
    },
  });
  assert(
    Boolean(counsel.counselingNote_ko?.includes("상담")),
    "counseling note"
  );
  assertNoDiseaseNames(counsel.summary_ko);
  assertNoDiseaseNames(counsel.counselingNote_ko ?? "");
  checks += 1;

  // 9. 질환명 없음 (위 assertNoDiseaseNames + 일반 미리보기)
  assertNoDiseaseNames(dry.summary_ko);
  checks += 1;

  // 10. 루틴 중복 없음
  const morningSet = new Set(dry.morning_tips);
  assert(morningSet.size === dry.morning_tips.length, "morning dedupe");
  const eveningSet = new Set(dry.evening_tips);
  assert(eveningSet.size === dry.evening_tips.length, "evening dedupe");
  assert(dry.morning_tips.includes("자외선 차단"), "am spf");
  assert(!dry.evening_tips.includes("자외선 차단"), "pm no spf merge");
  checks += 1;

  return { ok: true, checks };
}
