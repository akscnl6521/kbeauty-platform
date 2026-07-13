/** 런타임 설정 존재 여부만 노출한다. 값과 비밀키는 절대 기록하지 않는다. */
export const runtimeConfig = {
  hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
} as const;

export function hasPublicSupabaseConfig(): boolean {
  return runtimeConfig.hasSupabaseUrl && runtimeConfig.hasSupabaseAnonKey;
}
