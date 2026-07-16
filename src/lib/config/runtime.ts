import { getEnvPresenceReport } from "./env";

/** 런타임 설정 존재 여부만 노출한다. 값과 비밀키는 절대 기록하지 않는다. */
export const runtimeConfig = {
  hasSupabaseUrl: getEnvPresenceReport().hasSupabaseUrl,
  hasSupabaseAnonKey: getEnvPresenceReport().hasSupabaseAnonKey,
  hasServiceRoleKey: getEnvPresenceReport().hasServiceRoleKey,
} as const;

export function hasPublicSupabaseConfig(): boolean {
  return runtimeConfig.hasSupabaseUrl && runtimeConfig.hasSupabaseAnonKey;
}

export { assertProductionEnvSafe, getEnvPresenceReport } from "./env";
