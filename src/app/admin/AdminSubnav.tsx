import Link from "next/link";

const LINKS: Array<{ href: string; label: string; key: string }> = [
  { href: "/admin", label: "대시보드", key: "dashboard" },
  { href: "/admin/products", label: "Products", key: "products" },
  { href: "/admin/offers", label: "Offers", key: "offers" },
  { href: "/admin/discovery", label: "Discovery", key: "discovery" },
  { href: "/admin/ingredients", label: "Ingredients", key: "ingredients" },
  { href: "/admin/verification", label: "Verification", key: "verification" },
  { href: "/admin/pipeline", label: "Pipeline", key: "pipeline" },
  { href: "/admin/brands", label: "Brands", key: "brands" },
];

/**
 * Consistent read-only admin secondary navigation.
 */
export function AdminSubnav({ current }: { current: string }) {
  return (
    <nav
      className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm"
      aria-label="관리자 메뉴"
    >
      {LINKS.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={
              active
                ? "font-semibold text-gray-900"
                : "font-medium text-[#8B6914] underline"
            }
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
