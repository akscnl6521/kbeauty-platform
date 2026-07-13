"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { customerAuthErrorMessage, mapCustomerAuthError } from "@/lib/auth/customer-errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
export default function ResetPasswordPage() {
 const router=useRouter(); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError(null);try{const client=createSupabaseBrowserClient();const {data}=await client.auth.getUser();if(!data.user){setError("reset_expired");return;}const {error: updateError}=await client.auth.updateUser({password});if(updateError){setError(mapCustomerAuthError(updateError.message));return;}await client.auth.signOut();router.push("/login?reset=1");router.refresh();}catch{setError("config");}finally{setBusy(false);}}
 return <main className="min-h-screen bg-[#FAF7F5] px-4 py-16"><form onSubmit={submit} className="mx-auto max-w-md rounded-2xl bg-white p-6"><h1 className="text-2xl font-bold">새 비밀번호 설정</h1><label className="mt-6 block text-sm">새 비밀번호<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2"/></label>{error&&<p className="mt-3 text-sm text-rose-700">{customerAuthErrorMessage(error as never)}</p>}<button disabled={busy} className="mt-4 w-full rounded-lg bg-[#C2185B] py-2 text-white">{busy?"저장 중…":"비밀번호 저장"}</button></form></main>;
}
