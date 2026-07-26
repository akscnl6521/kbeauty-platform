"use client";
import { useEffect, useState } from "react";
import { buildRoutineDraft } from "@/lib/care/routine-draft";
import type { CareRoutineItem } from "@/lib/care/types";

export default function NewRoutinePage() {
  const [items, setItems] = useState<CareRoutineItem[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { try { setItems(buildRoutineDraft(JSON.parse(localStorage.getItem("skinRankedProducts") || "[]"))); } catch { setItems(buildRoutineDraft()); } }, []); // eslint-disable-line react-hooks/set-state-in-effect -- mount-time hydrate from localStorage; not available during server render
  const update = (index: number, patch: Partial<CareRoutineItem>) => setItems((old) => old.map((item, i) => i === index ? { ...item, ...patch } : item));
  async function save() {
    if (!confirm("이 초안을 내 루틴으로 저장할까요?")) return;
    const response = await fetch("/api/care/routines", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    setMessage(response.ok ? "루틴을 저장했습니다." : "루틴 저장 API를 사용할 수 없습니다. 초안은 화면에서만 편집됩니다.");
  }
  return <main className="mx-auto max-w-2xl px-5 py-12"><h1 className="text-2xl font-bold">내 루틴 초안</h1><p className="mt-2 text-sm text-gray-600">추천을 자동 적용하지 않습니다. 순서와 빈도를 직접 확인한 뒤 저장하세요.</p><div className="mt-6 space-y-3">{items.map((item, index) => <div key={item.id} className="rounded-lg border p-4"><p className="font-medium">{item.customProductName ?? item.productId ?? "제품"}</p><div className="mt-3 flex gap-2"><select value={item.frequency} onChange={(e) => update(index, { frequency: e.target.value as CareRoutineItem["frequency"] })}><option value="daily">매일</option><option value="every_other_day">격일</option><option value="2x_week">주 2회</option><option value="as_needed">필요 시</option></select><input type="number" min="1" value={item.order} onChange={(e) => update(index, { order: Number(e.target.value) })} className="w-16 border px-2" aria-label="사용 순서" /></div></div>)}</div><button type="button" onClick={() => void save()} className="mt-6 rounded bg-[#C2185B] px-5 py-3 text-white">확인 후 저장</button>{message ? <p className="mt-3 text-sm">{message}</p> : null}</main>;
}
