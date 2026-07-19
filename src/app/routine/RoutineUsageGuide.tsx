"use client";

/**
 * Thin re-export: routine page may keep this path; logic lives in
 * `@/components/usage/ProductUsageGuide`.
 */
export {
  default,
  parseVerifiedUsageGuide,
} from "@/components/usage/ProductUsageGuide";
export type {
  ProductUsageGuideLocale,
  ProductUsageGuideProps,
  StoredUsageGuide,
} from "@/components/usage/ProductUsageGuide";
