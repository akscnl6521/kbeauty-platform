import { SignupForm } from "./SignupForm";
import { Suspense } from "react";
export default function SignupPage() { return <main className="min-h-screen bg-[#FAF7F5] px-4 py-16"><div className="mx-auto max-w-md rounded-2xl border border-[#E8DFD8] bg-white p-6"><h1 className="text-2xl font-bold">피부 관리 시작하기</h1><p className="mt-2 text-sm text-gray-600">내 기록과 루틴을 안전하게 이어서 관리해요.</p><Suspense fallback={<p className="mt-6 text-sm">준비 중…</p>}><SignupForm /></Suspense></div></main>; }
