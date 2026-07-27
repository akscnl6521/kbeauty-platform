import Link from "next/link";

const LINKS: Array<{ href: string; label: string; key: string }> = [
  { href: "/admin", label: "대시보드", key: "dashboard" },
  { href: "/admin/review", label: "통합 검수", key: "review" },
  { href: "/admin/clinics", label: "병원 검수", key: "clinics" },
  { href: "/admin/commerce", label: "상업 분리", key: "commerce" },
  { href: "/admin/products", label: "제품 관리", key: "products" },
  { href: "/admin/products/import", label: "제품 일괄등록", key: "product-import" },
  { href: "/admin/catalog", label: "Catalog", key: "catalog" },
  { href: "/admin/catalog/ops", label: "사용·운영", key: "catalog-ops" },
  {
    href: "/admin/catalog/scenario-coverage",
    label: "시나리오 커버리지",
    key: "scenario-coverage",
  },
  { href: "/admin/offers", label: "Offers", key: "offers" },
  { href: "/admin/discovery", label: "Discovery", key: "discovery" },
  { href: "/admin/ingredients", label: "Ingredients", key: "ingredients" },
  { href: "/admin/evidence", label: "Evidence", key: "evidence" },
  { href: "/admin/verification", label: "Verification", key: "verification" },
  { href: "/admin/media-review", label: "영상 검수", key: "media-review" },
  { href: "/admin/pipeline", label: "Pipeline", key: "pipeline" },
  { href: "/admin/operations", label: "Operations", key: "operations" },
  { href: "/admin/care", label: "Care", key: "care" },
  { href: "/admin/brands", label: "Brands", key: "brands" },
];

/**
 * Consistent read-only admin secondary navigation.
 */
export function AdminSubnav({ current }: { current: string }) {
  return (
    <nav
      className="-mx-1 mt-4 overflow-x-auto px-1"
      aria-label="관리자 메뉴"
    >
      <div className="flex min-w-max flex-wrap gap-x-3 gap-y-1 text-sm sm:flex-wrap">
        {LINKS.map((item) => {
          const active = item.key === current;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={
                active
                  ? "touch-target inline-flex items-center font-semibold text-gray-900"
                  : "touch-target inline-flex items-center font-medium text-[#8B6914] underline"
              }
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
