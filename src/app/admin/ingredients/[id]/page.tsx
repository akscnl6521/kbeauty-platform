import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminIngredientDetail,
  parseAdminIngredientId,
  type AdminIngredientDetailPayload,
} from "@/lib/admin/ingredient-detail";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { AdminSubnav } from "../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Ingredient Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-[#E8DFD8] pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BoolLabel({ value }: { value: boolean }) {
  return <span className="font-medium">{value ? "true" : "false"}</span>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function StringList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SafeUrl({
  url,
  safe,
  label,
}: {
  url: string | null;
  safe: boolean;
  label: string;
}) {
  if (!url) return <span className="text-gray-400">—</span>;
  if (!safe) return <span className="text-xs text-gray-400">링크 비활성</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-[#8B6914] underline"
    >
      {label}
    </a>
  );
}

function DetailBody({ data }: { data: AdminIngredientDetailPayload }) {
  const { ingredient, aliases, evidence, cautions, linkedProducts, statusSummary } =
    data;

  return (
    <>
      <Section title="기본 정보">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">ID</dt>
            <dd className="tabular-nums font-medium">{ingredient.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">slug</dt>
            <dd>{ingredient.slug}</dd>
          </div>
          <div>
            <dt className="text-gray-500">영문명</dt>
            <dd className="font-medium">{ingredient.nameEn}</dd>
          </div>
          <div>
            <dt className="text-gray-500">한글명</dt>
            <dd>{ingredient.nameKo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">일본어명</dt>
            <dd>{ingredient.nameJa ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">created_at</dt>
            <dd className="tabular-nums">{formatDate(ingredient.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">active</dt>
            <dd className="text-gray-400">컬럼 없음</dd>
          </div>
          <div>
            <dt className="text-gray-500">ingredient verified</dt>
            <dd>
              <BoolLabel value={statusSummary.ingredientVerified} />
              <span className="ml-2 text-xs text-gray-400">
                (verified_at 컬럼 없음)
              </span>
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="상태 요약"
        description="ingredient verified와 evidence 존재는 별개입니다."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">hasAlias</dt>
            <dd>
              <BoolLabel value={statusSummary.hasAlias} /> ({statusSummary.aliasCount})
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">hasEvidence</dt>
            <dd>
              <BoolLabel value={statusSummary.hasEvidence} /> (
              {statusSummary.evidenceCount}, approved{" "}
              {statusSummary.approvedEvidenceCount})
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">hasCaution</dt>
            <dd>
              <BoolLabel value={statusSummary.hasCaution} /> (
              {statusSummary.cautionCount}, approved{" "}
              {statusSummary.approvedCautionCount})
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">hasLinkedProduct</dt>
            <dd>
              <BoolLabel value={statusSummary.hasLinkedProduct} /> (
              {statusSummary.linkedProductCount})
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="효과 · 기전 · 주의 (레거시 텍스트)">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-gray-500">effects</p>
            <StringList items={ingredient.effects} empty="없음" />
          </div>
          <div>
            <p className="text-gray-500">effects_ko</p>
            <StringList items={ingredient.effectsKo} empty="없음" />
          </div>
          <div>
            <p className="text-gray-500">mechanism</p>
            <p className="mt-1 text-gray-800">{ingredient.mechanism ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">mechanism_ko</p>
            <p className="mt-1 text-gray-800">{ingredient.mechanismKo ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">caution</p>
            <p className="mt-1 text-gray-800">{ingredient.caution ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">caution_ko</p>
            <p className="mt-1 text-gray-800">{ingredient.cautionKo ?? "—"}</p>
          </div>
        </div>
      </Section>

      <Section title="논문 링크 (레거시)">
        <div className="space-y-4 text-sm">
          {[ingredient.paper1, ingredient.paper2].map((paper, index) => (
            <div
              key={`paper-${index + 1}`}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
            >
              <p className="font-medium text-gray-900">paper {index + 1}</p>
              <p className="mt-1">{paper.title ?? "—"}</p>
              <p className="mt-1 text-gray-600">
                {paper.journal ?? "—"} · {paper.year ?? "—"}
              </p>
              <p className="mt-2">
                <SafeUrl url={paper.url} safe={paper.urlSafeHttps} label="논문 열기" />
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Aliases" description="INCI는 alias_type=inci 행만 해당">
        {aliases.length === 0 ? (
          <p className="text-sm text-gray-500">alias 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">alias</th>
                  <th className="px-3 py-2 font-medium">type</th>
                  <th className="px-3 py-2 font-medium">lang</th>
                  <th className="px-3 py-2 font-medium">review</th>
                  <th className="px-3 py-2 font-medium">active</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">{item.alias}</td>
                    <td className="px-3 py-2">{item.aliasType}</td>
                    <td className="px-3 py-2">{item.languageCode ?? "—"}</td>
                    <td className="px-3 py-2">{item.reviewStatus}</td>
                    <td className="px-3 py-2">
                      <BoolLabel value={item.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Evidence"
        description="evidence 존재 ≠ ingredient verified"
      >
        {evidence.length === 0 ? (
          <p className="text-sm text-gray-500">evidence 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">type</th>
                  <th className="px-3 py-2 font-medium">level</th>
                  <th className="px-3 py-2 font-medium">review</th>
                  <th className="px-3 py-2 font-medium">year</th>
                  <th className="px-3 py-2 font-medium">source</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">{item.evidenceType}</td>
                    <td className="px-3 py-2">{item.evidenceLevel}</td>
                    <td className="px-3 py-2">{item.reviewStatus}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.publicationYear ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <SafeUrl
                        url={item.sourceUrl}
                        safe={item.sourceUrlSafeHttps}
                        label="출처"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Cautions">
        {cautions.length === 0 ? (
          <p className="text-sm text-gray-500">caution 없음</p>
        ) : (
          <ul className="space-y-3">
            {cautions.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm"
              >
                <p className="font-medium text-gray-900">
                  {item.cautionType} · {item.severity} · {item.reviewStatus}
                </p>
                <p className="mt-1 text-gray-800">{item.description}</p>
                {item.condition ? (
                  <p className="mt-1 text-gray-600">조건: {item.condition}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="연결 제품" description="product_ingredients">
        {linkedProducts.length === 0 ? (
          <p className="text-sm text-gray-500">연결 제품 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">product</th>
                  <th className="px-3 py-2 font-medium">verification</th>
                  <th className="px-3 py-2 font-medium">key</th>
                  <th className="px-3 py-2 font-medium">order</th>
                </tr>
              </thead>
              <tbody>
                {linkedProducts.map((item) => (
                  <tr
                    key={`${item.productId}-${item.ingredientOrder}`}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/products/${item.productId}`}
                        className="font-medium text-[#8B6914] underline"
                      >
                        {item.productName ?? `product #${item.productId}`}
                      </Link>
                      {item.productBrand ? (
                        <span className="ml-2 text-xs text-gray-500">
                          {item.productBrand}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{item.verificationStatus}</td>
                    <td className="px-3 py-2">
                      <BoolLabel value={item.isKeyIngredient} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.ingredientOrder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/**
 * Read-only ingredient detail. No edit/verify actions.
 */
export default async function AdminIngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id: rawId } = await params;
  const ingredientId = parseAdminIngredientId(rawId);
  if (ingredientId == null) notFound();

  let data: AdminIngredientDetailPayload | null = null;
  let loadFailed = false;

  try {
    data = await getAdminIngredientDetail(ingredientId);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) {
      loadFailed = true;
    }
  }

  if (!loadFailed && !data) notFound();

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">성분 상세</h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
            {data ? (
              <p className="mt-2 text-sm text-gray-600">
                {data.ingredient.nameEn}
                {data.ingredient.nameKo
                  ? ` · ${data.ingredient.nameKo}`
                  : null}
              </p>
            ) : null}
            <AdminSubnav current="ingredients" />
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 text-sm">
          <Link
            href="/admin/ingredients"
            className="font-medium text-[#8B6914] underline"
          >
            목록으로 돌아가기
          </Link>
        </p>

        {loadFailed || !data ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            성분 상세를 불러오지 못했습니다.{" "}
            <Link href="/admin/ingredients" className="font-medium underline">
              목록으로 이동
            </Link>
          </div>
        ) : (
          <DetailBody data={data} />
        )}
      </div>
    </main>
  );
}
