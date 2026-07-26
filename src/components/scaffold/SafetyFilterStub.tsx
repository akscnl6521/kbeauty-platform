/**
 * Scaffold-mode placeholder for a safety filter (allergy / pregnancy-lactation /
 * red-flag symptom check). Always passes (`true`) so the click-through flow
 * never blocks — this is intentionally NOT real safety logic.
 * Wire the real check (see src/lib/care/symptomSafety.ts and profile allergy
 * fields) into `evaluate()` before this screen leaves scaffold mode.
 */
export type SafetyFilterStubResult = {
  passed: true;
  checks: Array<{ id: string; label: string }>;
};

export function evaluateSafetyFilterStub(): SafetyFilterStubResult {
  return {
    passed: true,
    checks: [
      { id: "allergy", label: "알레르기 성분 확인" },
      { id: "pregnancy_lactation", label: "임신·수유 주의 확인" },
      { id: "red_flag", label: "위험 신호(증상 급변 등) 확인" },
    ],
  };
}

export function SafetyFilterStub() {
  const result = evaluateSafetyFilterStub();
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-600">
      <p className="font-semibold text-gray-700">
        안전 필터 자리 (스캐폴드 · 항상 통과)
      </p>
      <ul className="mt-2 space-y-1">
        {result.checks.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span aria-hidden className="text-gray-400">
              ☐
            </span>
            {c.label} — <span className="italic">실제 로직 미연결</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
