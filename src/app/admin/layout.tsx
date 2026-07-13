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

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/unauthorized",
  "/admin/forbidden",
]);

/**
 * Server admin guard for all /admin/* routes except unauthorized/forbidden.
 * Proxy refreshes cookies only; final role check is here via admin_users.
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
        redirect("/admin/unauthorized");
      }
      if (
        error instanceof AdminAccessDeniedError ||
        error instanceof AdminInactiveError ||
        error instanceof AdminRoleDeniedError ||
        error instanceof AdminConfigurationError
      ) {
        redirect("/admin/forbidden");
      }
      redirect("/admin/forbidden");
    }
  }

  return <>{children}</>;
}
