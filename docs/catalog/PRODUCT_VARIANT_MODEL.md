# Product Variant Model

## variant_type

- shade
- size
- scent
- pack
- formula

## ingredient_scope

- common
- variant_specific
- may_contain
- unknown

Never flatten shade-specific + may_contain into one INCI string.

## Color products

lip_color / base_makeup / color_makeup / eye_makeup / brow_makeup should carry shade variants when sold by shade.

- Prefer official swatch images
- `color_hex` is auxiliary only — not an official brand color claim
- Missing swatch → warning (accuracy), not fake image fill

## Tables (staging migration file)

`catalog_product_variants` — apply only on staging Supabase.
