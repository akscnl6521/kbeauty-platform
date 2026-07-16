import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEnvPresenceReport } from "@/lib/config/env";

export const dynamic = "force-dynamic";

async function probeSupabase(): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) return null;

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.from("products").select("id", { head: true, count: "exact" }).limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const env = getEnvPresenceReport();
  const supabaseConfigured = env.hasSupabaseUrl && env.hasSupabaseAnonKey;
  const supabaseReachable = await probeSupabase();
  const requiredConfigPresent = env.requiredConfigPresent;
  const ok = requiredConfigPresent;

  return NextResponse.json(
    {
      ok,
      status: ok && supabaseReachable !== false ? "ok" : "degraded",
      app: "kbeauty-platform",
      version:
        process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
      supabaseConfigured,
      supabaseReachable,
      requiredConfigPresent,
    },
    { status: ok ? 200 : 503 }
  );
}
