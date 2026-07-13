import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  AdminAccessDeniedError,
  AdminConfigurationError,
  AdminInactiveError,
  AdminRoleDeniedError,
  AuthenticationRequiredError,
} from "@/lib/auth/errors";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin | K-Beauty Match",
  robots: { index: false, follow: false },
};

/** Paths that must not run requireAdminUser (avoid redirect loops). */
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/unauthorized",
  "/admin/forbidden",
  "/admin/unavailable",
]);

/**
 * Server admin guard for /admin/* except public auth pages.
 * Final authority is admin_users via service-role server client.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (!PUBLIC_ADMIN_PATHS.has(pathname)) {
    try {
      await requireAdminUser();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        redirect("/admin/login");
      }
      if (error instanceof AdminConfigurationError) {
        redirect("/admin/unavailable");
      }
      if (
        error instanceof AdminAccessDeniedError ||
        error instanceof AdminInactiveError ||
        error instanceof AdminRoleDeniedError
      ) {
        redirect("/admin/forbidden");
      }
      redirect("/admin/forbidden");
    }
  }

  return <>{children}</>;
}
