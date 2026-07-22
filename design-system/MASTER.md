# K-Beauty Match Design System — MASTER (Draft)

> **Draft / 초안** (2026-07-22): 이 문서는 UI 기준 초안이다. 페이지 redesign은 아직 실시하지 않았다.

## Product identity

- **KO:** K-Beauty Match는 피부 분석 → 검증 추천 → 루틴 → 경과 관리 플랫폼이다. 제품은 지원 수단; 주인물이 아니다.
- **EN:** Skin analysis, verified recommendations, routine, and continuous care. Products support the journey; the UI is not a shop, spa, marketplace, or price-comparison catalog.
- 거부: UI UX Pro Max spa / dark OLED / `#2563EB` blue SaaS defaults 채택 금지.

## User journey

1. Home — 이해 / CTA → Analyze
2. Analyze — 증상 / 피부 정보 입력
3. Results — 안전 분기 + Top 3–5 추천
4. Routine — 저장 / 체크인 / 조정 제안
5. My — 이력 / 동의 / 경과
6. Professional care — 전문가 상담 우선 (홍조 / 심한 염증 등)

## Design principles

- One job per page / section
- User skin first, product second
- Calm warm paper UI (not dark OLED, not purple AI gradient)
- Safety and trust before conversion
- Mobile-first Korean readability; long INCI text must remain readable
- Never fake reviews, scores, stock, or urgency

## Color tokens

Base from `src/app/globals.css`:

| Token | Value | Role |
|---|---|---|
| `--background` | `#faf7f5` | Warm paper canvas |
| `--foreground` | `#1a1a1a` | Primary text |
| `--brand` | `#c2185b` | Brand / primary CTA / focus |

Semantic (map onto warm neutrals + brand; do not invent spa teal or `#2563EB`):

| Semantic | Intent | UI use |
|---|---|---|
| guidance | Helpful next step | Tips, helper text |
| progress | On-track care | Check-in success, routine progress |
| caution | Soft warning | Mild irritation notes |
| stop / professional | Stop product push | 전문가 상담 / urgent |
| confidence | Evidence confidence | Evidence strength label |
| sponsored | Affiliate / ad | Visually separated from Organic |

Surface: `.kb-surface` warm paper gradients. Focus: brand outline (`:focus-visible`).

## Typography roles

- Body / UI: DM Sans (via app font pipeline)
- Display / brand moments: Fraunces via `.kb-display`
- Roles: page title, section title, body, helper, INCI/long-form, caption, CTA label
- Korean line-height: prefer comfortable leading for long ingredient lists

## Spacing scale

- 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Section gaps larger than card-internal gaps
- Touch target minimum: 44px

## Radius policy

- Soft, restrained radii for inputs and interactive surfaces
- Avoid pill clusters and marketplace chip walls
- Hero and primary journey surfaces: prefer composition over card chrome

## Shadow policy

- Minimal elevation; paper-like, not glassmorphism stacks
- No multi-layer glow / neon SaaS shadows

## Motion policy

- 2–3 intentional motions max for presence/hierarchy
- Prefer opacity/transform short easing; respect reduced-motion
- No confetti, fake urgency pulse, or shop-sale animations

## Layout / grid

- Content max ~ `--site-content-max` (72rem)
- Single-column mobile; progressive split on desktop for analysis/results only when hierarchy stays skin-first
- No catalog product grids as the primary results pattern

## Header / navigation

- Sticky header height via `--site-header-height`
- Hero/body must clear header offset
- Primary nav mirrors journey: Analyze / Results context / Routine / My
- Admin routes visually and access-separated from consumer care

## Skin analysis components

- Step clarity, symptom safety gates, photo consent when used
- Progress without gamified streaks that pressure purchase
- Empty: explain what is needed; never invent skin scores

## Recommendation components

- Internal rank pool: Top 10 candidates
- User-facing: Top 3–5 only
- Show why (skin fit / evidence / safety), not shop merchandising
- Organic vs sponsored: distinct treatment; sponsored never disguised
- Never default to dense catalog grid

## Routine / check-in components

- Day 3/7/15/30 check-ins; pause != delete; undo supported
- Adjustment suggestions require user approval before mutation
- Progress language is care-oriented, not streak-shop pressure

## Professional-care escalation

- 홍조 / 심한 염증 / 통증 / 지속 악화: 제품 추천 보다 전문가 상담 우선
- Use stop/professional semantic; suppress buy paths
- Copy must not diagnose; guide to qualified care

## Product presentation

- Brand, name, size, verified status, key fit reasons
- Full ingredients readable; no truncated INCI that hides allergens
- Price/stock only when sale-checked; no invented availability

## Affiliate disclosure

- Clear sponsored/affiliate labeling (semantic: sponsored)
- Visual separation from Organic recommendations
- Disclosure near the offer, not buried only in footer

## Loading / empty / error states

- Loading: calm skeleton or honest progress; no fake products
- Empty: explain next action; never pad with mock reviews/stats
- Error: recoverable path + safety-preserving fallback

## Accessibility

- Focus-visible brand outline; keyboard complete flows
- Touch target >= 44px; contrast on warm paper
- Meaningful labels for analysis controls and disclosures
- Honor prefers-reduced-motion

## Responsive breakpoints

Validate at: 320, 375, 768, 1024, 1440, 1920.

- 320–375: single column, large tap targets, no horizontal trap
- 768: optional two-tone hierarchy without catalog grids
- 1024+: max-width content, header offset stable
- 1440–1920: do not stretch into empty merchandising banners

## Korean content rules

- Primary UI copy in Korean; avoid Engrish CTA clutter
- Medical boundary language careful; no disease claims
- Long Korean + INCI blocks need spacing and wrapping, not chips-only UI

## Anti-patterns

- Spa / salon / wellness marketplace templates
- Dark OLED SaaS dashboards; purple AI gradients; default `#2563EB`
- Buy now, discount badges, fake scarcity
- Catalog grid as primary recommendation UI
- Filling empty states with fake products, reviews, or scores
- Letting Pro Max product taxonomy override K-Beauty Match identity

## Pre-delivery checklist

- [ ] Single page job + journey stage + primary action documented
- [ ] Skills used: kbeauty-match-design + frontend-design + ui-ux-pro-max (filtered)
- [ ] Tokens match globals (`#faf7f5` / `#1a1a1a` / `#c2185b`)
- [ ] Top 3–5 only; Organic vs sponsored separated
- [ ] Safety / expert_first paths intact
- [ ] Empty/error honest; mobile + Korean + a11y checked
- [ ] Preview only; no main/Production without approval

## Skill priority reference

1. `.cursor/skills/kbeauty-match-design/SKILL.md`
2. `.cursor/skills/frontend-design/SKILL.md`
3. `.cursor/skills/ui-ux-pro-max/SKILL.md`
4. This file + `design-system/pages/`
5. Rule: `.cursor/rules/kbeauty-ui-design.mdc`
6. Install manifest: `.cursor/skills/INSTALL_MANIFEST.md`

Conflict rule: K-Beauty Match identity and safety always win.
