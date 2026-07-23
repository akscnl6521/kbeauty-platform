"use client";

import { CommerceLaneBadge } from "@/components/commerce/CommerceLaneBadge";

export type SponsoredCardProps = {
  id: string;
  title: string;
  disclosureText: string;
  destinationUrl: string | null;
  partner: string | null;
  onTrackClick?: (id: string) => void;
};

/**
 * Sponsored placement card — never rendered inside Organic recommendation lists.
 */
export function SponsoredCard({
  id,
  title,
  disclosureText,
  destinationUrl,
  partner,
  onTrackClick,
}: SponsoredCardProps) {
  return (
    <article
      className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-3"
      data-commerce-lane="sponsored"
      data-entity-id={id}
    >
      <CommerceLaneBadge lane="sponsored" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      {partner ? (
        <p className="mt-1 text-xs text-violet-900">파트너: {partner}</p>
      ) : null}
      <p className="mt-1 text-xs text-violet-900">{disclosureText}</p>
      {destinationUrl ? (
        <a
          href={destinationUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-2 inline-flex text-xs font-semibold text-[#C2185B] underline"
          onClick={() => onTrackClick?.(id)}
        >
          광고 페이지 열기
        </a>
      ) : (
        <p className="mt-2 text-xs text-gray-600">
          검증된 광고 목적지 URL이 아직 없습니다.
        </p>
      )}
    </article>
  );
}
