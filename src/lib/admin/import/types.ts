/**
 * Shared discovery import types (safe for client + server).
 */

export type PreviewItemStatus =
  | "ready"
  | "duplicate"
  | "incomplete"
  | "failed";

export type ImportPreviewItem = {
  inputUrl: string;
  canonicalUrl: string | null;
  productName: string | null;
  brandName: string | null;
  detectedCountry: string | null;
  sourceType: string | null;
  imageUrl: string | null;
  description: string | null;
  domain: string | null;
  price: string | null;
  currency: string | null;
  availability: string | null;
  status: PreviewItemStatus;
  duplicateCandidateId: string | null;
  duplicateProductId: number | null;
  warnings: string[];
  errorCode: string | null;
  errorMessage: string | null;
};

export type ImportPreviewSummary = {
  total: number;
  ready: number;
  duplicate: number;
  incomplete: number;
  failed: number;
};
