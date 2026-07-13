import Link from "next/link";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AdminSubnav } from "../AdminSubnav";

const TABS = [
  { href: "/admin/catalog", label: "Audit" },
  { href: "/admin/catalog/sources", label: "Sources" },
  { href: "/admin/catalog/jobs", label: "Jobs" },
  { href: "/admin/catalog/staging", label: "Staging" },
  { href: "/admin/catalog/ingredients", label: "Ingredients" },
  { href: "/admin/catalog/offers", label: "Offers" },
  { href: "/admin/catalog/media", label: "Media" },
  { href: "/admin/catalog/variants", label: "Variants" },
  { href: "/admin/catalog/taxonomy", label: "Taxonomy" },
  { href: "/admin/catalog/domain-review", label: "Domains" },
  { href: "/admin/catalog/review", label: "Review" },
] as const;

export function CatalogAutomationShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6914]">
              Catalog automation · read-only
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">{description}</p>
          </div>
          <AdminLogoutButton />
        </div>
        <AdminSubnav current="catalog" />
        <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Catalog automation">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded border border-[#E8DFD8] bg-white px-3 py-1.5 text-[#8B6914] underline"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
