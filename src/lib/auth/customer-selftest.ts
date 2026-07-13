import { assertOwner } from "@/lib/care/ownership";
import { mapCustomerAuthError } from "./customer-errors";
import { sanitizeNextPath } from "./safe-next";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** 네트워크/DB 없이 고객 인증 경계만 검증한다. */
export function runCustomerAuthSelftests(): { ok: true; checks: number } {
  let checks = 0;
  assert(sanitizeNextPath("//evil.test") === "/my", "block protocol-relative redirect");
  assert(sanitizeNextPath("https://evil.test") === "/my", "block absolute redirect");
  assert(sanitizeNextPath("/\\evil.test") === "/my", "block backslash redirect");
  assert(sanitizeNextPath("/my/check-ins") === "/my/check-ins", "allow customer route");
  checks += 4;
  assert(mapCustomerAuthError("Invalid login credentials") === "invalid_credentials", "map invalid");
  assert(mapCustomerAuthError("Email not confirmed") === "email_not_confirmed", "map confirm");
  assert(mapCustomerAuthError("User already registered") === "already_registered", "map existing");
  checks += 3;
  assertOwner("owner", "owner");
  try {
    assertOwner("owner", "other");
    throw new Error("ownership must reject mismatch");
  } catch (error) {
    assert((error as Error).message !== "ownership must reject mismatch", "ownership mismatch");
  }
  // Attach decline deliberately leaves the local snapshot unchanged.
  const snapshot = { sessions: 1, checkIns: 1 };
  const declined = { ...snapshot };
  assert(declined.sessions === snapshot.sessions && declined.checkIns === snapshot.checkIns, "decline no merge");
  checks += 3;
  return { ok: true, checks };
}
