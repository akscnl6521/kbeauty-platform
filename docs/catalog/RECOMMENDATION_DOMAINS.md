# Recommendation Domains

Each domain has its own candidate pool and (stub) ranker inputs.

| Domain | Inputs (summary) | Ranker |
|--------|------------------|--------|
| face_skincare | skin type, concerns, sensitivity, redness, ingredients | `rankProducts` (unchanged formula) + `filterFaceSkincareCandidates` |
| sun_care | SPF/PA, finish, white cast, water resistance | `rankSunCareProducts` stub |
| lip_care | dryness, tinted/clear | `rankLipCareProducts` stub |
| lip_color | shade, finish, opacity | `rankLipColorProducts` stub |
| base_makeup | finish, coverage, shade range | `rankBaseMakeupProducts` stub |
| color_makeup | shade, finish, intensity | `rankColorMakeupProducts` stub |
| scalp_care | scalp type/concerns + hair-loss safety | `rankScalpProducts` |
| hair_care | thickness, curl, damage, color | `rankHairProducts` |
| body_care | dryness, fragrance, exfoliation | `rankBodyCareProducts` stub |

## Hard rules

- No lipstick/shampoo in face_skincare pools
- No sunscreen-only scoring as color makeup
- Hair-loss observation → safety triage; never simple shampoo score conversion
- `expert_first` / professional consultation → no purchase push

Full consumer UX per domain is a follow-up feature module.
