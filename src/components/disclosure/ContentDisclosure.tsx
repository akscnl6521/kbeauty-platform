"use client";

import {
  getContentDisclosureLabel,
  type ContentDisclosureLocale,
  type ContentRelationship,
} from "@/lib/media/contentDisclosurePolicy";

export type ContentDisclosureProps = {
  relationship: ContentRelationship;
  disclosureText?: string | null;
  locale?: ContentDisclosureLocale;
  className?: string;
};

/**
 * Compact, shared disclosure label + body.
 * Organic / empty → renders nothing. No HTML injection, no autoplay.
 */
export default function ContentDisclosure({
  relationship,
  disclosureText,
  locale = "ko",
  className,
}: ContentDisclosureProps) {
  if (relationship === "organic") return null;
  const label = getContentDisclosureLabel(relationship, locale);
  const body = disclosureText?.trim() || null;
  if (!label && !body) return null;

  return (
    <div
      className={
        className ??
        "mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950"
      }
      data-content-relationship={relationship}
      role="note"
    >
      {label ? <p className="font-semibold">{label}</p> : null}
      {body ? <p className={label ? "mt-0.5 leading-snug" : undefined}>{body}</p> : null}
    </div>
  );
}
