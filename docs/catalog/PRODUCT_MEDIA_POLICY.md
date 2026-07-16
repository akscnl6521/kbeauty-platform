# Product Media Policy

## Allowed sources (priority)

1. Brand official product page / CDN / PDF / country mall
2. Authorized retailer detail or partner feed (Coupang/Olive Young only when approved)
3. Public product DB (auxiliary)

## Forbidden

- Search-engine image URLs as product photos
- Blog / SNS / review UGC without license
- Seller photos marked as official brand assets
- Watermark removal / hotlink bypass / CAPTCHA bypass
- AI-generated images as real product photos
- Substituting another product’s image when one is broken

## Usage rights

| Status | Meaning |
|--------|---------|
| official_remote_use | Remote official URL OK |
| licensed_copy_allowed | Storage copy allowed |
| external_link_only | Link only; no storage clone |
| unknown | needs_review |
| prohibited | Do not use |

Default: store official remote URL. Copy to Supabase Storage only when rights allow.

## Validation (structural)

HTTPS, no credentials, no private IP, placeholder/tracking detection, prohibited source types, optional host vs product page check.

Live HTTP fetch jobs must not run against shared Production.

## Display

1. verified primary `product_front`
2. verified packaging
3. verified official image
4. fallback: “제품 이미지 준비 중”

Alt: `{brand} {product} {shade?} 제품 이미지`

Broken image → fallback only (never swap another SKU).
