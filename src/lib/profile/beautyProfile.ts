/**
 * Durable, category-neutral beauty profile.
 * Confirmed values always win over inferred values; both remain auditable.
 */

export type ProfileValueSource = "user_confirmed" | "inferred";

export type ProfileValue<T> = {
  value: T;
  source: ProfileValueSource;
  updatedAt: string;
};

export type ProductExperienceStatus =
  | "current"
  | "past"
  | "discontinued"
  | "satisfactory"
  | "adverse";

export type ProductExperience = {
  productId: string | null;
  productName: string;
  status: ProductExperienceStatus;
  reaction: string | null;
  updatedAt: string;
};

export type BeautyProfile = {
  version: 1;
  updatedAt: string;
  locale: {
    country?: ProfileValue<string>;
    shippingCountry?: ProfileValue<string>;
    language?: ProfileValue<string>;
    currency?: ProfileValue<string>;
    timezone?: ProfileValue<string>;
  };
  general: {
    ageBand?: ProfileValue<string>;
    lifeStage?: ProfileValue<string>;
    budgetBand?: ProfileValue<string>;
    preferredBrands: ProfileValue<string[]>;
    excludedBrands: ProfileValue<string[]>;
    allergies: ProfileValue<string[]>;
    fragrancePreference?: ProfileValue<string>;
  };
  skin: {
    type?: ProfileValue<string>;
    sensitivity?: ProfileValue<string>;
    concerns: ProfileValue<string[]>;
    areas: ProfileValue<string[]>;
    triggers: ProfileValue<string[]>;
    recommendedIngredients: ProfileValue<string[]>;
    avoidedIngredients: ProfileValue<string[]>;
    redFlags: ProfileValue<string[]>;
  };
  makeup: {
    toneDepth?: ProfileValue<string>;
    undertone?: ProfileValue<string>;
    preferredColors: ProfileValue<string[]>;
    preferredFinishes: ProfileValue<string[]>;
    eyeSensitivity?: ProfileValue<boolean>;
    lipSensitivity?: ProfileValue<boolean>;
    contactLensUse?: ProfileValue<boolean>;
  };
  hairScalp: {
    scalpType?: ProfileValue<string>;
    concerns: ProfileValue<string[]>;
    hairConcerns: ProfileValue<string[]>;
    chemicalHistory: ProfileValue<string[]>;
  };
  bodyNailFragrance: {
    concerns: ProfileValue<string[]>;
    fragranceFamilies: ProfileValue<string[]>;
    sensitivityNotes: ProfileValue<string[]>;
  };
  productHistory: ProductExperience[];
  goalHistory: Array<{ goal: string; recordedAt: string }>;
};

function listValue(value: string[], source: ProfileValueSource, now: string) {
  return { value: [...new Set(value.filter(Boolean))], source, updatedAt: now };
}

export function createEmptyBeautyProfile(now = new Date().toISOString()): BeautyProfile {
  return {
    version: 1,
    updatedAt: now,
    locale: {},
    general: {
      preferredBrands: listValue([], "inferred", now),
      excludedBrands: listValue([], "inferred", now),
      allergies: listValue([], "inferred", now),
    },
    skin: {
      concerns: listValue([], "inferred", now),
      areas: listValue([], "inferred", now),
      triggers: listValue([], "inferred", now),
      recommendedIngredients: listValue([], "inferred", now),
      avoidedIngredients: listValue([], "inferred", now),
      redFlags: listValue([], "inferred", now),
    },
    makeup: {
      preferredColors: listValue([], "inferred", now),
      preferredFinishes: listValue([], "inferred", now),
    },
    hairScalp: {
      concerns: listValue([], "inferred", now),
      hairConcerns: listValue([], "inferred", now),
      chemicalHistory: listValue([], "inferred", now),
    },
    bodyNailFragrance: {
      concerns: listValue([], "inferred", now),
      fragranceFamilies: listValue([], "inferred", now),
      sensitivityNotes: listValue([], "inferred", now),
    },
    productHistory: [],
    goalHistory: [],
  };
}

export function mergeProfileValue<T>(
  current: ProfileValue<T> | undefined,
  incoming: ProfileValue<T> | undefined
): ProfileValue<T> | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  if (current.source === "user_confirmed" && incoming.source === "inferred") {
    return current;
  }
  return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt)
    ? incoming
    : current;
}

function mergeLists(
  current: ProfileValue<string[]>,
  incoming: string[],
  source: ProfileValueSource,
  now: string
): ProfileValue<string[]> {
  if (current.source === "user_confirmed" && source === "inferred") return current;
  return listValue([...current.value, ...incoming], source, now);
}

export type ProfileObservation = {
  source: ProfileValueSource;
  recordedAt?: string;
  country?: string | null;
  shippingCountry?: string | null;
  language?: string | null;
  currency?: string | null;
  timezone?: string | null;
  ageBand?: string | null;
  budgetBand?: string | null;
  skinType?: string | null;
  sensitivity?: string | null;
  concerns?: string[];
  areas?: string[];
  triggers?: string[];
  undertone?: string | null;
  toneDepth?: string | null;
  allergies?: string[];
  avoidedIngredients?: string[];
  recommendedIngredients?: string[];
  redFlags?: string[];
  goals?: string[];
  preferredColors?: string[];
  preferredFinishes?: string[];
  eyeSensitivity?: boolean | null;
  lipSensitivity?: boolean | null;
  contactLensUse?: boolean | null;
  scalpType?: string | null;
  hairConcerns?: string[];
  scalpConcerns?: string[];
  chemicalHistory?: string[];
  bodyNailConcerns?: string[];
  fragranceFamilies?: string[];
};

/** User-confirmed scalar/list edits from the Beauty Profile editor. */
export type ConfirmedProfilePatch = {
  country?: string | null;
  shippingCountry?: string | null;
  language?: string | null;
  currency?: string | null;
  ageBand?: string | null;
  budgetBand?: string | null;
  skinType?: string | null;
  sensitivity?: string | null;
  undertone?: string | null;
  toneDepth?: string | null;
  scalpType?: string | null;
  fragrancePreference?: string | null;
  allergies?: string[];
  preferredBrands?: string[];
  excludedBrands?: string[];
  concerns?: string[];
  avoidedIngredients?: string[];
  recommendedIngredients?: string[];
};

export function applyProfileObservation(
  profile: BeautyProfile,
  observation: ProfileObservation
): BeautyProfile {
  const now = observation.recordedAt ?? new Date().toISOString();
  const scalar = <T>(value: T | null | undefined): ProfileValue<T> | undefined =>
    value == null || value === ""
      ? undefined
      : { value, source: observation.source, updatedAt: now };

  return {
    ...profile,
    updatedAt: now,
    locale: {
      country: mergeProfileValue(profile.locale.country, scalar(observation.country)),
      shippingCountry: mergeProfileValue(
        profile.locale.shippingCountry,
        scalar(observation.shippingCountry)
      ),
      language: mergeProfileValue(profile.locale.language, scalar(observation.language)),
      currency: mergeProfileValue(profile.locale.currency, scalar(observation.currency)),
      timezone: mergeProfileValue(profile.locale.timezone, scalar(observation.timezone)),
    },
    general: {
      ...profile.general,
      ageBand: mergeProfileValue(profile.general.ageBand, scalar(observation.ageBand)),
      budgetBand: mergeProfileValue(
        profile.general.budgetBand,
        scalar(observation.budgetBand)
      ),
      allergies: mergeLists(
        profile.general.allergies,
        observation.allergies ?? [],
        observation.source,
        now
      ),
    },
    skin: {
      ...profile.skin,
      type: mergeProfileValue(profile.skin.type, scalar(observation.skinType)),
      sensitivity: mergeProfileValue(
        profile.skin.sensitivity,
        scalar(observation.sensitivity)
      ),
      concerns: mergeLists(
        profile.skin.concerns,
        observation.concerns ?? [],
        observation.source,
        now
      ),
      areas: mergeLists(
        profile.skin.areas,
        observation.areas ?? [],
        observation.source,
        now
      ),
      triggers: mergeLists(
        profile.skin.triggers,
        observation.triggers ?? [],
        observation.source,
        now
      ),
      recommendedIngredients: mergeLists(
        profile.skin.recommendedIngredients,
        observation.recommendedIngredients ?? [],
        observation.source,
        now
      ),
      avoidedIngredients: mergeLists(
        profile.skin.avoidedIngredients,
        observation.avoidedIngredients ?? [],
        observation.source,
        now
      ),
      redFlags: mergeLists(
        profile.skin.redFlags,
        observation.redFlags ?? [],
        observation.source,
        now
      ),
    },
    makeup: {
      ...profile.makeup,
      undertone: mergeProfileValue(profile.makeup.undertone, scalar(observation.undertone)),
      toneDepth: mergeProfileValue(profile.makeup.toneDepth, scalar(observation.toneDepth)),
      preferredColors: mergeLists(
        profile.makeup.preferredColors,
        observation.preferredColors ?? [],
        observation.source,
        now
      ),
      preferredFinishes: mergeLists(
        profile.makeup.preferredFinishes,
        observation.preferredFinishes ?? [],
        observation.source,
        now
      ),
      eyeSensitivity: mergeProfileValue(
        profile.makeup.eyeSensitivity,
        scalar(observation.eyeSensitivity)
      ),
      lipSensitivity: mergeProfileValue(
        profile.makeup.lipSensitivity,
        scalar(observation.lipSensitivity)
      ),
      contactLensUse: mergeProfileValue(
        profile.makeup.contactLensUse,
        scalar(observation.contactLensUse)
      ),
    },
    hairScalp: {
      ...profile.hairScalp,
      scalpType: mergeProfileValue(
        profile.hairScalp.scalpType,
        scalar(observation.scalpType)
      ),
      concerns: mergeLists(
        profile.hairScalp.concerns,
        observation.scalpConcerns ?? [],
        observation.source,
        now
      ),
      hairConcerns: mergeLists(
        profile.hairScalp.hairConcerns,
        observation.hairConcerns ?? [],
        observation.source,
        now
      ),
      chemicalHistory: mergeLists(
        profile.hairScalp.chemicalHistory,
        observation.chemicalHistory ?? [],
        observation.source,
        now
      ),
    },
    bodyNailFragrance: {
      ...profile.bodyNailFragrance,
      concerns: mergeLists(
        profile.bodyNailFragrance.concerns,
        observation.bodyNailConcerns ?? [],
        observation.source,
        now
      ),
      fragranceFamilies: mergeLists(
        profile.bodyNailFragrance.fragranceFamilies,
        observation.fragranceFamilies ?? [],
        observation.source,
        now
      ),
    },
    goalHistory: [
      ...profile.goalHistory,
      ...(observation.goals ?? []).map((goal) => ({ goal, recordedAt: now })),
    ].slice(-100),
  };
}

/**
 * Apply explicit user edits. All fields are stored as user_confirmed.
 * Explicit list patches replace (not append) so the profile editor is predictable.
 */
export function applyConfirmedProfilePatch(
  profile: BeautyProfile,
  patch: ConfirmedProfilePatch,
  recordedAt = new Date().toISOString()
): BeautyProfile {
  let next = applyProfileObservation(profile, {
    source: "user_confirmed",
    recordedAt,
    country: patch.country,
    shippingCountry: patch.shippingCountry,
    language: patch.language,
    currency: patch.currency,
    ageBand: patch.ageBand,
    budgetBand: patch.budgetBand,
    skinType: patch.skinType,
    sensitivity: patch.sensitivity,
    undertone: patch.undertone,
    toneDepth: patch.toneDepth,
    scalpType: patch.scalpType,
  });

  if (patch.allergies) {
    next = {
      ...next,
      general: {
        ...next.general,
        allergies: listValue(patch.allergies, "user_confirmed", recordedAt),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.concerns) {
    next = {
      ...next,
      skin: {
        ...next.skin,
        concerns: listValue(patch.concerns, "user_confirmed", recordedAt),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.avoidedIngredients) {
    next = {
      ...next,
      skin: {
        ...next.skin,
        avoidedIngredients: listValue(
          patch.avoidedIngredients,
          "user_confirmed",
          recordedAt
        ),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.recommendedIngredients) {
    next = {
      ...next,
      skin: {
        ...next.skin,
        recommendedIngredients: listValue(
          patch.recommendedIngredients,
          "user_confirmed",
          recordedAt
        ),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.preferredBrands) {
    next = {
      ...next,
      general: {
        ...next.general,
        preferredBrands: listValue(patch.preferredBrands, "user_confirmed", recordedAt),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.excludedBrands) {
    next = {
      ...next,
      general: {
        ...next.general,
        excludedBrands: listValue(patch.excludedBrands, "user_confirmed", recordedAt),
      },
      updatedAt: recordedAt,
    };
  }
  if (patch.fragrancePreference != null && patch.fragrancePreference !== "") {
    next = {
      ...next,
      general: {
        ...next.general,
        fragrancePreference: {
          value: patch.fragrancePreference,
          source: "user_confirmed",
          updatedAt: recordedAt,
        },
      },
      updatedAt: recordedAt,
    };
  }
  return next;
}

/** Map domain quiz answers into a profile observation (confirmed by the user). */
export function observationFromDomainQuiz(input: {
  domain: string;
  answers: Record<string, string>;
  recordedAt?: string;
}): ProfileObservation {
  const a = input.answers;
  const base: ProfileObservation = {
    source: "user_confirmed",
    recordedAt: input.recordedAt,
  };
  if (input.domain === "mascara") {
    return {
      ...base,
      eyeSensitivity: a.sensitiveEyes === "yes" ? true : a.sensitiveEyes === "no" ? false : null,
      preferredFinishes: [a.effect].filter(Boolean),
      goals: ["mascara_fit"],
    };
  }
  if (input.domain === "lip") {
    return {
      ...base,
      undertone: a.undertone ?? null,
      preferredFinishes: [a.finish].filter(Boolean),
      preferredColors: [a.shadeFamily, a.color].filter(Boolean) as string[],
      lipSensitivity: a.dryLips === "yes" ? true : a.dryLips === "no" ? false : null,
      goals: ["lip_fit"],
    };
  }
  if (input.domain === "base") {
    return {
      ...base,
      undertone: a.undertone ?? null,
      preferredFinishes: [a.finish].filter(Boolean),
      goals: ["base_makeup_fit"],
    };
  }
  if (input.domain === "hair") {
    return {
      ...base,
      scalpType: a.scalpType ?? null,
      scalpConcerns: [a.concern, a.dandruff].filter(Boolean) as string[],
      hairConcerns: [a.hairConcern, a.damage].filter(Boolean) as string[],
      chemicalHistory: [a.coloring, a.perm].filter(Boolean) as string[],
      goals: ["scalp_hair_fit"],
    };
  }
  return { ...base, goals: [`${input.domain}_quiz`] };
}
