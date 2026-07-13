"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  completeCheckIn,
  loadCareStore,
  type CareCheckInAnswers,
  type CareStoreSnapshot,
} from "@/lib/care";
import { MyCareNav } from "../../MyCareNav";

const emptyAnswers = (): CareCheckInAnswers => ({
  stillUsing: true,
  sting: 2,
  itch: 1,
  redness: 2,
  dryness: 3,
  oiliness: 3,
  breakouts: 2,
  swelling: 0,
  peeling: 1,
  satisfaction: 6,
  adherence: 7,
  photoAttached: false,
  freeMemo: null,
});

export default function MyCheckInDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  const [answers, setAnswers] = useState(emptyAnswers());
  const [done, setDone] = useState(false);

  useEffect(() => setStore(loadCareStore()), []);

  const checkIn = store?.checkIns.find((c) => c.id === id);

  function submit() {
    const next = completeCheckIn(id, answers);
    setStore(next);
    setDone(true);
  }

  if (!checkIn) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
        <p>체크인을 찾을 수 없습니다.</p>
        <Link href="/my/check-ins" className="text-[#8B6914] underline">
          목록
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Day {checkIn.day} 체크인</h1>
      <MyCareNav current="/my/check-ins" />
      <p className="mt-2 text-sm text-gray-600">
        짧은 선택형입니다. 진단이 아니며, 사진만으로 질환을 판정하지 않습니다.
      </p>

      {checkIn.status === "completed" || done ? (
        <div className="mt-6 space-y-3 text-sm">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            완료되었습니다. 제안은 동의 후에만 루틴에 반영됩니다.
          </p>
          <Link href="/my/progress" className="text-[#8B6914] underline">
            변화 보기
          </Link>
          {(store?.suggestions ?? [])
            .filter((s) => s.checkInId === id)
            .map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
              >
                <p className="font-medium">{s.title}</p>
                <p className="text-gray-700">{s.reason}</p>
                <p className="text-xs text-gray-500">{s.expectedEffect}</p>
              </div>
            ))}
        </div>
      ) : (
        <form
          className="mt-6 space-y-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {(
            [
              ["sting", "따가움"],
              ["itch", "가려움"],
              ["redness", "붉음"],
              ["dryness", "건조"],
              ["oiliness", "유분"],
              ["breakouts", "트러블"],
              ["swelling", "붓기"],
              ["peeling", "벗겨짐"],
              ["satisfaction", "만족도"],
              ["adherence", "루틴 준수"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-gray-700">
                {label} (0–10)
              </span>
              <input
                type="range"
                min={0}
                max={10}
                className="mt-1 w-full"
                value={answers[key] ?? 0}
                onChange={(e) =>
                  setAnswers({ ...answers, [key]: Number(e.target.value) })
                }
              />
              <span className="tabular-nums text-xs text-gray-500">
                {answers[key]}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={answers.stillUsing === true}
              onChange={(e) =>
                setAnswers({ ...answers, stillUsing: e.target.checked })
              }
            />
            계속 사용 중
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-white"
          >
            저장
          </button>
        </form>
      )}
    </main>
  );
}
