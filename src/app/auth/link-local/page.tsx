"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { sanitizeCustomerNextPath } from "@/lib/auth/safe-next";
import { loadCareStore } from "@/lib/care";
import { attachLocalCareStore } from "@/lib/care/client-hydrate";
function LinkLocalContent() {
 const router=useRouter();const search=useSearchParams();const [counts,setCounts]=useState({sessions:0,routines:0,checkIns:0});const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const next=sanitizeCustomerNextPath(search.get("next"));
 useEffect(()=>{const store=loadCareStore();setCounts({sessions:store.sessions.length,routines:store.routines.length,checkIns:store.checkIns.length});},[]); // eslint-disable-line react-hooks/set-state-in-effect -- mount-time hydrate from localStorage; must start at server-safe default (0) and sync client-side only, cannot read localStorage during initial render
 async function attach(){setBusy(true);const result=await attachLocalCareStore();setBusy(false);if(result.ok){router.push(next);router.refresh();}else setMessage("연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");}
 function decline(){sessionStorage.setItem("careAttachDeclined","1");router.push(next);}
 return <main className="min-h-screen bg-[#FAF7F5] px-4 py-16"><section className="mx-auto max-w-md rounded-2xl bg-white p-6"><h1 className="text-2xl font-bold">이 기기의 기록을 연결할까요?</h1><p className="mt-3 text-sm text-gray-600">분석 {counts.sessions}건 · 루틴 {counts.routines}건 · 체크인 {counts.checkIns}건을 계정에 연결합니다. 메모 내용은 여기에서 표시하지 않습니다.</p>{message&&<p className="mt-3 text-sm text-rose-700">{message}</p>}<button disabled={busy} onClick={()=>void attach()} className="mt-6 w-full rounded-lg bg-[#C2185B] py-2 text-white">{busy?"연결 중…":"기록 연결하기"}</button><button onClick={decline} className="mt-3 w-full py-2 text-sm text-gray-600 underline">지금은 연결하지 않기</button></section></main>;
}

export default function LinkLocalPage() {
 return <Suspense fallback={<main className="min-h-screen bg-[#FAF7F5]" />}><LinkLocalContent /></Suspense>;
}
