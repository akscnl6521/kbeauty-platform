# Beauty Catalog Taxonomy

Canonical product categories for K-Beauty Match.

## Domains

| Domain | Purpose |
|--------|---------|
| face_skincare | Face cleansing / treatment / masks |
| sun_care | SPF / PA UV products |
| lip_care | Balm / lip treatment (not color) |
| lip_color | Lipstick / tint / gloss |
| base_makeup | Foundation / cushion / primer / powder |
| color_makeup | Blush / contour / highlighter |
| eye_makeup | Shadow / liner / mascara |
| brow_makeup | Brow pencil / gel |
| scalp_care | Scalp-focused cleansers & tonics |
| hair_care | Hair condition / style |
| hair_loss_support | Non-therapeutic support (claims verified separately) |
| body_care | Body wash / lotion |
| hand_foot_care | Hand / foot |
| shaving_care | Shave / beard |
| baby_kids | Baby / kids (incl. kids sunscreen) |
| nail_care | Polish / care |
| fragrance | Perfume / mist |
| beauty_tools | Tools / devices |
| other | Unmapped |

Men’s grooming is **target_audience** metadata, not a separate category domain.

## Rules

- Never invent a category from a search result title alone.
- Ambiguous tokens (`shampoo`, `mask`, `tone up`, hair-loss marketing) → `needs_review`.
- Do not mix domains in one recommendation candidate pool.
- `rankProducts` formula is unchanged; use `filterFaceSkincareCandidates` before ranking face products.

## Admin

`/admin/catalog/taxonomy` — read-only domain / alias viewer.

## Staging

Apply `20260714040000_beauty_taxonomy_media_variants.sql` only on a separate staging Supabase project.
