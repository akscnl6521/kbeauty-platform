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
  // Empty incoming must not "confirm" an empty list and block later inferred updates.
  if (!incoming.length) return current;
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

const MAX_LIST = 40;
const MAX_SCALAR = 80;
const MAX_GOALS = 100;
const MAX_PRODUCTS = 50;

function asString(value: unknown, max = MAX_SCALAR): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown, maxItems = MAX_LIST): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
    ),
  ].slice(0, maxItems);
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asProfileValue<T>(
  raw: unknown,
  coerce: (v: unknown) => T | null | undefined,
  now: string
): ProfileValue<T> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as { value?: unknown; source?: unknown; updatedAt?: unknown };
  const value = coerce(row.value);
  if (value == null || value === "") return undefined;
  const source: ProfileValueSource =
    row.source === "user_confirmed" ? "user_confirmed" : "inferred";
  const updatedAt = asString(row.updatedAt, 40) ?? now;
  return { value, source, updatedAt };
}

function asListProfileValue(
  raw: unknown,
  now: string
): ProfileValue<string[]> {
  if (!raw || typeof raw !== "object") {
    return listValue([], "inferred", now);
  }
  const row = raw as { value?: unknown; source?: unknown; updatedAt?: unknown };
  const source: ProfileValueSource =
    row.source === "user_confirmed" ? "user_confirmed" : "inferred";
  const updatedAt = asString(row.updatedAt, 40) ?? now;
  return listValue(asStringList(row.value), source, updatedAt);
}

/**
 * Safe parse for durable BeautyProfile JSON (local store / server jsonb).
 * Corrupt or partial payloads fall back to empty profile shells without throwing.
 */
export function parseBeautyProfile(
  raw: unknown,
  fallbackNow = new Date().toISOString()
): BeautyProfile {
  const empty = createEmptyBeautyProfile(fallbackNow);
  if (!raw || typeof raw !== "object") return empty;
  const row = raw as Record<string, unknown>;
  const now = asString(row.updatedAt, 40) ?? fallbackNow;
  const locale =
    row.locale && typeof row.locale === "object"
      ? (row.locale as Record<string, unknown>)
      : {};
  const general =
    row.general && typeof row.general === "object"
      ? (row.general as Record<string, unknown>)
      : {};
  const skin =
    row.skin && typeof row.skin === "object"
      ? (row.skin as Record<string, unknown>)
      : {};
  const makeup =
    row.makeup && typeof row.makeup === "object"
      ? (row.makeup as Record<string, unknown>)
      : {};
  const hairScalp =
    row.hairScalp && typeof row.hairScalp === "object"
      ? (row.hairScalp as Record<string, unknown>)
      : {};
  const bodyNailFragrance =
    row.bodyNailFragrance && typeof row.bodyNailFragrance === "object"
      ? (row.bodyNailFragrance as Record<string, unknown>)
      : {};

  const productHistory = Array.isArray(row.productHistory)
    ? row.productHistory
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const p = item as Record<string, unknown>;
          const status = asString(p.status, 32);
          const allowed: ProductExperienceStatus[] = [
            "current",
            "past",
            "discontinued",
            "satisfactory",
            "adverse",
          ];
          if (!status || !allowed.includes(status as ProductExperienceStatus)) {
            return null;
          }
          const productName = asString(p.productName, 120);
          if (!productName) return null;
          return {
            productId: asString(p.productId, 64),
            productName,
            status: status as ProductExperienceStatus,
            reaction: asString(p.reaction, 200),
            updatedAt: asString(p.updatedAt, 40) ?? now,
          } satisfies ProductExperience;
        })
        .filter((item): item is ProductExperience => Boolean(item))
        .slice(0, MAX_PRODUCTS)
    : [];

  const goalHistory = Array.isArray(row.goalHistory)
    ? row.goalHistory
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const g = item as Record<string, unknown>;
          const goal = asString(g.goal, 80);
          if (!goal) return null;
          return {
            goal,
            recordedAt: asString(g.recordedAt, 40) ?? now,
          };
        })
        .filter((item): item is { goal: string; recordedAt: string } =>
          Boolean(item)
        )
        .slice(-MAX_GOALS)
    : [];

  return {
    version: 1,
    updatedAt: now,
    locale: {
      country: asProfileValue(locale.country, asString, now),
      shippingCountry: asProfileValue(locale.shippingCountry, asString, now),
      language: asProfileValue(locale.language, asString, now),
      currency: asProfileValue(locale.currency, asString, now),
      timezone: asProfileValue(locale.timezone, asString, now),
    },
    general: {
      ageBand: asProfileValue(general.ageBand, asString, now),
      lifeStage: asProfileValue(general.lifeStage, asString, now),
      budgetBand: asProfileValue(general.budgetBand, asString, now),
      preferredBrands: asListProfileValue(general.preferredBrands, now),
      excludedBrands: asListProfileValue(general.excludedBrands, now),
      allergies: asListProfileValue(general.allergies, now),
      fragrancePreference: asProfileValue(
        general.fragrancePreference,
        asString,
        now
      ),
    },
    skin: {
      type: asProfileValue(skin.type, asString, now),
      sensitivity: asProfileValue(skin.sensitivity, asString, now),
      concerns: asListProfileValue(skin.concerns, now),
      areas: asListProfileValue(skin.areas, now),
      triggers: asListProfileValue(skin.triggers, now),
      recommendedIngredients: asListProfileValue(
        skin.recommendedIngredients,
        now
      ),
      avoidedIngredients: asListProfileValue(skin.avoidedIngredients, now),
      redFlags: asListProfileValue(skin.redFlags, now),
    },
    makeup: {
      toneDepth: asProfileValue(makeup.toneDepth, asString, now),
      undertone: asProfileValue(makeup.undertone, asString, now),
      preferredColors: asListProfileValue(makeup.preferredColors, now),
      preferredFinishes: asListProfileValue(makeup.preferredFinishes, now),
      eyeSensitivity: asProfileValue(makeup.eyeSensitivity, asBool, now),
      lipSensitivity: asProfileValue(makeup.lipSensitivity, asBool, now),
      contactLensUse: asProfileValue(makeup.contactLensUse, asBool, now),
    },
    hairScalp: {
      scalpType: asProfileValue(hairScalp.scalpType, asString, now),
      concerns: asListProfileValue(hairScalp.concerns, now),
      hairConcerns: asListProfileValue(hairScalp.hairConcerns, now),
      chemicalHistory: asListProfileValue(hairScalp.chemicalHistory, now),
    },
    bodyNailFragrance: {
      concerns: asListProfileValue(bodyNailFragrance.concerns, now),
      fragranceFamilies: asListProfileValue(
        bodyNailFragrance.fragranceFamilies,
        now
      ),
      sensitivityNotes: asListProfileValue(
        bodyNailFragrance.sensitivityNotes,
        now
      ),
    },
    productHistory,
    goalHistory,
  };
}

/** Merge two profiles; confirmed values win over inferred; newer timestamps win ties. */
export function mergeBeautyProfiles(
  base: BeautyProfile,
  incoming: BeautyProfile
): BeautyProfile {
  const now =
    Date.parse(incoming.updatedAt) >= Date.parse(base.updatedAt)
      ? incoming.updatedAt
      : base.updatedAt;

  const mergeListField = (
    a: ProfileValue<string[]>,
    b: ProfileValue<string[]>
  ): ProfileValue<string[]> => {
    // Union list values; if either side is confirmed, keep confirmed source.
    const source: ProfileValueSource =
      a.source === "user_confirmed" || b.source === "user_confirmed"
        ? "user_confirmed"
        : "inferred";
    const updatedAt =
      Date.parse(a.updatedAt) >= Date.parse(b.updatedAt)
        ? a.updatedAt
        : b.updatedAt;
    return listValue([...a.value, ...b.value], source, updatedAt);
  };

  const productMap = new Map<string, ProductExperience>();
  for (const item of [...base.productHistory, ...incoming.productHistory]) {
    const key = `${item.productId ?? ""}|${item.productName}|${item.status}`;
    const prev = productMap.get(key);
    if (!prev || Date.parse(item.updatedAt) >= Date.parse(prev.updatedAt)) {
      productMap.set(key, item);
    }
  }

  return {
    version: 1,
    updatedAt: now,
    locale: {
      country: mergeProfileValue(base.locale.country, incoming.locale.country),
      shippingCountry: mergeProfileValue(
        base.locale.shippingCountry,
        incoming.locale.shippingCountry
      ),
      language: mergeProfileValue(base.locale.language, incoming.locale.language),
      currency: mergeProfileValue(base.locale.currency, incoming.locale.currency),
      timezone: mergeProfileValue(base.locale.timezone, incoming.locale.timezone),
    },
    general: {
      ageBand: mergeProfileValue(base.general.ageBand, incoming.general.ageBand),
      lifeStage: mergeProfileValue(
        base.general.lifeStage,
        incoming.general.lifeStage
      ),
      budgetBand: mergeProfileValue(
        base.general.budgetBand,
        incoming.general.budgetBand
      ),
      preferredBrands: mergeListField(
        base.general.preferredBrands,
        incoming.general.preferredBrands
      ),
      excludedBrands: mergeListField(
        base.general.excludedBrands,
        incoming.general.excludedBrands
      ),
      allergies: mergeListField(
        base.general.allergies,
        incoming.general.allergies
      ),
      fragrancePreference: mergeProfileValue(
        base.general.fragrancePreference,
        incoming.general.fragrancePreference
      ),
    },
    skin: {
      type: mergeProfileValue(base.skin.type, incoming.skin.type),
      sensitivity: mergeProfileValue(
        base.skin.sensitivity,
        incoming.skin.sensitivity
      ),
      concerns: mergeListField(base.skin.concerns, incoming.skin.concerns),
      areas: mergeListField(base.skin.areas, incoming.skin.areas),
      triggers: mergeListField(base.skin.triggers, incoming.skin.triggers),
      recommendedIngredients: mergeListField(
        base.skin.recommendedIngredients,
        incoming.skin.recommendedIngredients
      ),
      avoidedIngredients: mergeListField(
        base.skin.avoidedIngredients,
        incoming.skin.avoidedIngredients
      ),
      redFlags: mergeListField(base.skin.redFlags, incoming.skin.redFlags),
    },
    makeup: {
      toneDepth: mergeProfileValue(
        base.makeup.toneDepth,
        incoming.makeup.toneDepth
      ),
      undertone: mergeProfileValue(
        base.makeup.undertone,
        incoming.makeup.undertone
      ),
      preferredColors: mergeListField(
        base.makeup.preferredColors,
        incoming.makeup.preferredColors
      ),
      preferredFinishes: mergeListField(
        base.makeup.preferredFinishes,
        incoming.makeup.preferredFinishes
      ),
      eyeSensitivity: mergeProfileValue(
        base.makeup.eyeSensitivity,
        incoming.makeup.eyeSensitivity
      ),
      lipSensitivity: mergeProfileValue(
        base.makeup.lipSensitivity,
        incoming.makeup.lipSensitivity
      ),
      contactLensUse: mergeProfileValue(
        base.makeup.contactLensUse,
        incoming.makeup.contactLensUse
      ),
    },
    hairScalp: {
      scalpType: mergeProfileValue(
        base.hairScalp.scalpType,
        incoming.hairScalp.scalpType
      ),
      concerns: mergeListField(
        base.hairScalp.concerns,
        incoming.hairScalp.concerns
      ),
      hairConcerns: mergeListField(
        base.hairScalp.hairConcerns,
        incoming.hairScalp.hairConcerns
      ),
      chemicalHistory: mergeListField(
        base.hairScalp.chemicalHistory,
        incoming.hairScalp.chemicalHistory
      ),
    },
    bodyNailFragrance: {
      concerns: mergeListField(
        base.bodyNailFragrance.concerns,
        incoming.bodyNailFragrance.concerns
      ),
      fragranceFamilies: mergeListField(
        base.bodyNailFragrance.fragranceFamilies,
        incoming.bodyNailFragrance.fragranceFamilies
      ),
      sensitivityNotes: mergeListField(
        base.bodyNailFragrance.sensitivityNotes,
        incoming.bodyNailFragrance.sensitivityNotes
      ),
    },
    productHistory: [...productMap.values()].slice(-MAX_PRODUCTS),
    goalHistory: [...base.goalHistory, ...incoming.goalHistory].slice(-MAX_GOALS),
  };
}

/** Sanitize user-confirmed patch for API / editor boundaries. */
export function sanitizeConfirmedProfilePatch(
  patch: ConfirmedProfilePatch
): { ok: true; patch: ConfirmedProfilePatch } | { ok: false; message: string } {
  if (!patch || typeof patch !== "object") {
    return { ok: false, message: "프로필 수정 값이 올바르지 않습니다." };
  }
  const out: ConfirmedProfilePatch = {};

  const scalarEntries: Array<{
    key:
      | "country"
      | "shippingCountry"
      | "language"
      | "currency"
      | "ageBand"
      | "budgetBand"
      | "skinType"
      | "sensitivity"
      | "undertone"
      | "toneDepth"
      | "scalpType"
      | "fragrancePreference";
    raw: string | null | undefined;
  }> = [
    { key: "country", raw: patch.country },
    { key: "shippingCountry", raw: patch.shippingCountry },
    { key: "language", raw: patch.language },
    { key: "currency", raw: patch.currency },
    { key: "ageBand", raw: patch.ageBand },
    { key: "budgetBand", raw: patch.budgetBand },
    { key: "skinType", raw: patch.skinType },
    { key: "sensitivity", raw: patch.sensitivity },
    { key: "undertone", raw: patch.undertone },
    { key: "toneDepth", raw: patch.toneDepth },
    { key: "scalpType", raw: patch.scalpType },
    { key: "fragrancePreference", raw: patch.fragrancePreference },
  ];

  for (const { key, raw } of scalarEntries) {
    if (raw === undefined) continue;
    if (raw === null || raw === "") {
      out[key] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return { ok: false, message: `${key} 형식이 올바르지 않습니다.` };
    }
    out[key] = raw.trim().slice(0, MAX_SCALAR);
  }

  const listEntries: Array<{
    key:
      | "allergies"
      | "preferredBrands"
      | "excludedBrands"
      | "concerns"
      | "avoidedIngredients"
      | "recommendedIngredients";
    raw: string[] | undefined;
  }> = [
    { key: "allergies", raw: patch.allergies },
    { key: "preferredBrands", raw: patch.preferredBrands },
    { key: "excludedBrands", raw: patch.excludedBrands },
    { key: "concerns", raw: patch.concerns },
    { key: "avoidedIngredients", raw: patch.avoidedIngredients },
    { key: "recommendedIngredients", raw: patch.recommendedIngredients },
  ];

  for (const { key, raw } of listEntries) {
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) {
      return { ok: false, message: `${key} 목록 형식이 올바르지 않습니다.` };
    }
    out[key] = asStringList(raw);
  }

  return { ok: true, patch: out };
}

/**
 * Map check-in answers into an inferred profile observation.
 * Does not claim medical diagnosis; only records user-reported change signals.
 */
export function observationFromCheckIn(input: {
  answers: {
    stillUsing?: boolean | null;
    sting?: number | null;
    itch?: number | null;
    redness?: number | null;
    dryness?: number | null;
    overallResponse?: string | null;
    stoppedReason?: string | null;
    acuteSignals?: Record<string, boolean | undefined> | null;
  };
  recordedAt?: string;
}): ProfileObservation {
  const a = input.answers;
  const triggers: string[] = [];
  const redFlags: string[] = [];
  const concerns: string[] = [];

  if ((a.sting ?? 0) >= 3) triggers.push("sting_on_use");
  if ((a.itch ?? 0) >= 3) triggers.push("itch");
  if ((a.redness ?? 0) >= 3) concerns.push("redness");
  if ((a.dryness ?? 0) >= 3) concerns.push("dryness");

  if (a.overallResponse === "worsened") {
    concerns.push("worsening_after_routine");
    triggers.push("routine_worsening");
  }
  if (a.overallResponse === "stopped" || a.stillUsing === false) {
    triggers.push("routine_discontinued");
  }
  if (a.stoppedReason === "irritation") {
    triggers.push("irritation");
    redFlags.push("irritation_reported");
  }

  const acute = a.acuteSignals ?? {};
  for (const [key, on] of Object.entries(acute)) {
    if (on === true) redFlags.push(`acute_${key}`);
  }

  let sensitivity: string | null = null;
  if (
    (a.sting ?? 0) >= 3 ||
    (a.itch ?? 0) >= 3 ||
    a.stoppedReason === "irritation" ||
    redFlags.some((f) => f.startsWith("acute_"))
  ) {
    sensitivity = "elevated_reported";
  }

  return {
    source: "inferred",
    recordedAt: input.recordedAt,
    concerns,
    triggers,
    redFlags,
    sensitivity,
    goals: a.overallResponse ? [`checkin_${a.overallResponse}`] : [],
  };
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
