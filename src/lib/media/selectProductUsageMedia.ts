import {
  decideUsageMediaPublication,
  validateUsageInstruction,
  type UsageInstruction,
  type UsageMediaAsset,
} from "./productUsageMediaPolicy";

export type ProductUsageGuide = {
  productId: string;
  media: UsageMediaAsset | null;
  instruction: UsageInstruction | null;
  disclosureText: string | null;
};

function mediaPriority(asset: UsageMediaAsset): number {
  if (asset.mediaType === "video") return 0;
  if (asset.mediaType === "animation") return 1;
  return 2;
}

export function selectProductUsageGuide(
  productId: string,
  assets: UsageMediaAsset[],
  instructions: UsageInstruction[],
  now: Date = new Date()
): ProductUsageGuide {
  const mediaCandidates = assets
    .filter((asset) => asset.productId === productId)
    .map((asset) => ({ asset, decision: decideUsageMediaPublication(asset, now) }))
    .filter(({ decision }) => decision.publishable)
    .sort((a, b) => mediaPriority(a.asset) - mediaPriority(b.asset));

  const selectedMedia = mediaCandidates[0] ?? null;

  const instruction = instructions
    .filter((item) => item.productId === productId)
    .filter((item) => validateUsageInstruction(item).length === 0)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null;

  return {
    productId,
    media: selectedMedia?.asset ?? null,
    instruction,
    disclosureText: selectedMedia?.decision.disclosureText ?? null,
  };
}
