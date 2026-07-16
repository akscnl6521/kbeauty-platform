export type CustomerAuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "already_registered"
  | "weak_password"
  | "reset_expired"
  | "network"
  | "config"
  | "generic";

const messages: Record<CustomerAuthErrorCode, string> = {
  invalid_credentials: "이메일 또는 비밀번호를 다시 확인해 주세요.",
  email_not_confirmed: "이메일 인증을 완료한 뒤 로그인해 주세요.",
  already_registered: "이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.",
  weak_password: "비밀번호는 더 안전하게 설정해 주세요.",
  reset_expired: "비밀번호 재설정 링크가 만료되었거나 사용할 수 없습니다.",
  network: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  config: "로그인 설정을 확인할 수 없습니다.",
  generic: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export function mapCustomerAuthError(message?: string | null): CustomerAuthErrorCode {
  const value = (message ?? "").toLowerCase();
  if (/invalid login|invalid credentials/.test(value)) return "invalid_credentials";
  if (/email not confirmed/.test(value)) return "email_not_confirmed";
  if (/already registered|already been registered|user already exists/.test(value)) return "already_registered";
  if (/password.*(weak|least)|weak password/.test(value)) return "weak_password";
  if (/expired|invalid.*token|otp.*expired/.test(value)) return "reset_expired";
  if (/network|fetch|failed to fetch/.test(value)) return "network";
  if (/missing.*supabase|configuration|config/.test(value)) return "config";
  return "generic";
}

export function customerAuthErrorMessage(code: CustomerAuthErrorCode): string {
  return messages[code];
}
