import guidance from "@/../data/evidence/makeup-hair-attribute-guidance.json";

export type HairConcernGuidance = {
  concernCode: string;
  preferredAttributes: string[];
  ingredientHints: string[];
  evidenceLevel: string;
  disclaimerKo: string;
};

export type MakeupAttributeGuidance = {
  attribute: string;
  values: string[];
  usageKo: string;
  evidenceLevel: string;
};

export function getHairConcernGuidance(): HairConcernGuidance[] {
  return guidance.hairConcernEvidence as HairConcernGuidance[];
}

export function getMakeupAttributeGuidance(): MakeupAttributeGuidance[] {
  return guidance.makeupAttributeGuidance as MakeupAttributeGuidance[];
}

export function hairGuidanceFor(concernCode: string): HairConcernGuidance | null {
  return (
    getHairConcernGuidance().find((g) => g.concernCode === concernCode) ?? null
  );
}
