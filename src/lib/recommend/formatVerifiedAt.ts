/**
 * 사용자 화면용 검증일 포맷 (외부 라이브러리 없음).
 */

function isValidDate(d: Date): boolean {
  return Number.isFinite(d.getTime());
}

/**
 * verified_at 등 ISO/날짜 문자열 → locale별 표시.
 * 잘못된 값은 원문 노출 없이 null (호출측에서 "확인일 정보 없음").
 */
export function formatVerifiedAtForDisplay(
  value: string | null | undefined,
  locale: "en" | "ja" | "ko" = "ko",
  timeZone = "Asia/Seoul"
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (!isValidDate(date)) return null;

  try {
    if (locale === "ko") {
      const parts = new Intl.DateTimeFormat("ko-KR", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(date);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (!y || !m || !d) return null;
      return `${y}년 ${Number(m)}월 ${Number(d)}일 확인`;
    }
    if (locale === "ja") {
      return (
        new Intl.DateTimeFormat("ja-JP", {
          timeZone,
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(date) + " 確認"
      );
    }
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}
