"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import { nextDueCheckIn, countdownLabel } from "@/lib/care/schedule";
import type { CareCheckIn } from "@/lib/care/types";
import {
  evaluateCheckinReminderPolicy,
  getMilestoneLabel,
  milestoneFromDay,
  resolveCheckinConsent,
} from "@/lib/retention/checkinPolicy";
import { MyCareNav } from "../MyCareNav";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  due: "지금",
  completed: "완료",
  skipped: "건너뜀",
  expired: "만료",
  cancelled: "취소",
};

export default function MyCheckInsPage() {
  const [checkIns, setCheckIns] = useState<CareCheckIn[]>([]);
  const [careConsent, setCareConsent] = useState(true);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setCheckIns(h.dashboard.checkIns);
      const session = h.dashboard.sessions[0];
      if (session) {
        setCareConsent(
          resolveCheckinConsent({
            consentCareTracking: session.consentCareTracking,
            settings: h.dashboard.settings,
          }).careCheckinConsent
        );
      }
    });
  }, []);

  const nextCheckIn = useMemo(
    () => nextDueCheckIn(checkIns),
    [checkIns]
  );

  const nextReminder = useMemo(() => {
    if (!nextCheckIn) return null;
    return evaluateCheckinReminderPolicy({ checkIn: nextCheckIn });
  }, [nextCheckIn]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">체크인</h1>
      <MyCareNav current="/my/check-ins" />
      {!careConsent ? (
        <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          피부 관리 체크인 동의가 없어 새 일정은 생성되지 않습니다. 설정에서
          케어 추적 동의를 확인하세요.
        </p>
      ) : null}
      {nextCheckIn ? (
        <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            다음 체크인
          </p>
          <p className="mt-1 font-semibold">
            {getMilestoneLabel(milestoneFromDay(nextCheckIn.day))} ·{" "}
            {countdownLabel(nextCheckIn.dueAt)}
          </p>
          <p className="mt-1 text-gray-600">
            상태: {STATUS_LABEL[nextCheckIn.status] ?? nextCheckIn.status}
          </p>
          {nextReminder?.reminderStatus === "awaiting_first_reminder" ? (
            <p className="mt-2 text-xs text-gray-500">
              미응답 시 48시간 후 1회 재알림 후보 (발송 미연결)
            </p>
          ) : null}
          {(nextCheckIn.status === "due" ||
            nextCheckIn.status === "scheduled") && (
            <Link
              href={`/my/check-ins/${nextCheckIn.id}`}
              className="mt-3 inline-block text-[#8B6914] underline"
            >
              체크인 응답하기
            </Link>
          )}
        </section>
      ) : null}
      <ul className="mt-6 space-y-2 text-sm">
        {checkIns
          .slice()
          .sort((a, b) => a.day - b.day)
          .map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
            >
              <Link
                href={`/my/check-ins/${c.id}`}
                className="font-medium text-[#8B6914] underline"
              >
                Day {c.day}
              </Link>
              <span className="ml-2 text-gray-600">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
              <p className="text-xs text-gray-500">{c.dueAt}</p>
            </li>
          ))}
      </ul>
      {!checkIns.length ? (
        <p className="mt-4 text-sm text-gray-600">
          아직 체크인이 없습니다.{" "}
          <Link href="/my" className="text-[#8B6914] underline">
            홈에서 분석 저장
          </Link>
        </p>
      ) : null}
      <div className="mt-8">
        <Link
          href="/my/clinics"
          className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          피부과 추천 보기 →
        </Link>
      </div>
    </main>
  );
}
