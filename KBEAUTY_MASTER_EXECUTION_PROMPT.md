# K-Beauty Match — Master Execution Prompt

You are the primary execution agent for the K-Beauty Match repository.

Repository:
`C:\Users\조병선.DESKTOP-0S17OGB\Desktop\kbeauty-platform`

Execution mode:
- Codex CLI
- workspace-write
- approval policy: never
- work only on the current feature branch
- automatically perform safe code edits, local tests, builds, documentation updates, explicit-path git add, commits, and pushes to the current feature branch
- never merge main, deploy Production, modify Production DB/Storage/environment variables, use paid APIs, bypass login/CAPTCHA, or run destructive Git commands

## 1. Non-negotiable platform direction

K-Beauty Match is not a product catalog, shopping mall, affiliate-link site, ingredient dictionary, popularity ranking site, or one-time photo diagnosis tool.

It is a long-term personalized K-Beauty management platform centered on the user.

All work must reinforce this loop:

User understanding
→ structured goals and conditions
→ management priorities
→ suitable ingredients, colors, functions, and care methods
→ real Korean beauty product recommendations
→ correct usage and routines
→ saved results
→ 3/7/15/30-day follow-up
→ outcome-based routine/product adjustment
→ professional guidance when cosmetics are insufficient
→ updated long-term beauty profile
→ repeat engagement

Prioritize:
1. accurate understanding of the user
2. clear recommendation reasons
3. practical usage and routines
4. follow-up and outcome tracking
5. safety and professional escalation
6. Organic recommendation integrity
7. automated product-data expansion and refresh
8. country/language/currency/retailer support
9. Korean beauty product discovery and global purchase connection

Do not let the platform become:
- a product-listing shop
- an affiliate-first ad site
- a mock-data demo
- a manual one-product-at-a-time admin system
- a one-time recommendation with no reason to return
- a service that claims medical diagnosis from a photo

## 2. Analyze the real repository first

Read and reconcile:
- MASTER_PLAN.md if present
- PROJECT_RULE.md if present
- PROJECT_STATUS.md
- ROADMAP.md
- CHANGELOG.md
- README.md
- package.json
- src/**
- scripts/**
- data/**
- docs/**
- tests and selftests
- database types and migrations
- Supabase code
- recommendation, results, routine, storage, follow-up code
- product, brand, ingredient, offer, retailer, media code
- camera, photo, consent, storage, deletion code
- clinic/professional, affiliate, sponsored, disclosure code
- locale, country, currency, shipping code
- admin, import, collection, normalization, dedupe, verification code
- git status, branch, upstream, recent commits

Rules:
- code is the source of truth when docs disagree
- preserve recent completed work
- do not redo completed features
- do not delete unfinished work
- avoid unnecessary rewrites
- do not stop after producing a plan
- if the path is not the expected Git repository, stop without modifying anything

## 3. Final user experience

Users should be able to:
1. enter in their language and country context
2. choose a beauty-management area
3. complete a questionnaire and optional photo capture
4. see structured concerns, goals, sensitivity, and risk signals
5. understand what cosmetics can and cannot address
6. see recommended and avoid ingredients/colors/functions
7. receive real Korean product Top 3–5 recommendations
8. see reasons, cautions, price, currency, stock, shipping, retailer, verification date
9. view usage guidance and verified usage media
10. save results and routines
11. return at 3/7/15/30 days
12. record improvement, no change, worsening, irritation, or discontinuation
13. receive adjusted routines/products
14. receive symptom-based professional guidance when appropriate
15. maintain a long-term beauty profile and history

The user should feel continuously managed, not merely recommended a product once.

## 4. Long-term beauty profile

Support a durable user profile with:
- country, shipping country, language, currency
- age range, life stage, budget
- preferred/excluded brands
- allergies and sensitivity history
- fragrance preferences
- current, past, discontinued, satisfactory, and adverse products
- goals, recommendations, routines, follow-up history

Skin:
- type, sensitivity, concerns, body/face areas
- duration, recurrence, triggers, season/climate
- current products, recommended/avoid ingredients
- red flags

Makeup:
- skin tone, undertone, personal color
- preferred colors and finishes
- coverage, longevity, transfer/smudge preferences
- eye/lip sensitivity, contact lens use

Hair/scalp:
- scalp type, oiliness, dryness, dandruff, itch, sensitivity
- hair-loss concerns, hair thickness, damage, curl
- coloring, perm, heat-tool use, ingredient/fragrance preferences

Body/nail/fragrance:
- area-specific dryness, acne, keratin, sensitivity
- waxing/shaving context
- nail condition and allergy cautions
- fragrance families, season, time, occasion, sensitivity

Separate inferred values from user-confirmed values.

## 5. Full beauty taxonomy

The architecture must support all beauty-related product groups, while actual user-facing depth can be phased.

A. Skincare:
cleansers, exfoliants, toners, mists, pads, essences, serums, ampoules, emulsions, lotions, gels, creams, oils, balms, masks, spot care, acne-care cosmetics, eye/neck/lip care, sunscreen, after-sun, men, children, pregnancy-aware, sensitive-skin products.

B. Base makeup:
primer, base, tone-up, BB/CC, foundation, cushion, concealer, corrector, powder, pact, fixer, remover.

C. Color makeup:
blush, bronzer, contour, highlighter, glitter, eyeshadow, eyeliner, mascara, mascara fixer, lash products, brow products, lipstick, tint, gloss, liner, plumper, color balm, stage makeup.

D. Hair/scalp:
shampoo, dry shampoo, conditioner, treatment, mask, scaler, scrub, tonic, serum, hair-loss symptom-relief functional products, essence, oil, mist, leave-in treatment, heat protector, curl cream, wax, gel, spray, pomade, dye, bleach, color treatment, perm products.

E. Body:
wash, scrub, lotion, cream, oil, mist, hand/foot care, deodorant, odor/sweat care, shaving/waxing care, body-acne care, body sunscreen, area-specific care, external intimate cleansing cosmetics, massage cosmetics, pregnancy body care.

F. Nail:
polish, gel, base/top coat, remover, cuticle oil, strengthener, nail tips/stickers/art supplies, care tools, pedicure.

G. Fragrance:
parfum, EDP, EDT, cologne, solid perfume, roll-on, hair/body perfume, mist, layering products.

H. Beauty tools:
brushes, puffs, sponges, eyelash curlers, razors, tweezers, mirrors, combs, hair brushes/rollers/accessories, cleansing brushes, gua sha, rollers, color tools, containers, hygiene/storage/cleaning tools.

I. Beauty devices:
LED mask, galvanic, RF, ultrasound, microcurrent, cleansing device, pore suction, skin meter, dryer, iron, styler, scalp massager, electric shaver, epilator, nail drill, heated lash curler, device gels/pads/refills.

J. Oral/smile beauty:
whitening toothpaste, breath care, whitening strips, stain-care products.

K. Men’s grooming:
shaving, aftershave, beard care, men’s styling, makeup, body/fragrance.

L. Separate regulated/safety areas:
inner beauty, supplements, food, color contacts, medical-device candidates, salon/esthetic/professional chemical materials.

Do not recommend supplements, medicines, medical devices, color contacts, or professional chemicals as ordinary cosmetics. Build separate classification, safety gates, disclosures, and future interfaces.

New categories must be addable through taxonomy/category schema rather than large rewrites.

## 6. Category-specific recommendation engines

Never score all products with a skincare formula.

Common factors:
- user goal, budget, country, language
- availability, stock, price, currency, shipping
- brand preference/exclusion
- allergies/sensitivity
- data completeness, freshness, source confidence
- Organic/Affiliate/Sponsored separation

Category-specific factors:

Skincare:
skin type, concern, sensitivity, location, duration, recurrence, recommended/avoid ingredients, texture, step, season, routine conflicts.

Base makeup:
skin tone, undertone, depth, finish, coverage, longevity, oxidation, shade fit.

Color makeup:
personal color, hue, brightness, saturation, finish, pigmentation, transfer/smudge/water resistance, sensitivity.

Mascara:
volume, length, curl hold, smudge resistance, waterproof, removal type, brush shape, clumping, eye sensitivity, contact lenses, lash condition.

Lip:
tone, undertone, natural lip color, dryness, hue, brightness, saturation, opacity, gloss, longevity, stain, fragrance/flavor, plumping irritation.

Hair/scalp:
scalp type, oiliness, dryness, dandruff, itch, sensitivity, hair loss, damage, coloring/perm, cleansing, moisture, protein, sulfate/silicone policy, fragrance, use frequency.

Body:
area, dryness, acne, exfoliation, sensitivity, texture, absorption, stickiness, season, waxing/shaving.

Nail:
condition, damage, color, wear, removal/curing method, allergy caution, professional-only status.

Fragrance:
families, notes, season, time, occasion, projection, longevity, sensitivity, layering.

Tools:
purpose, skill level, material, hygiene, cleaning, replacement, compatibility, damage risk.

Devices:
purpose, area, mechanism, intensity, frequency, contraindications, certification, medical-device status, voltage/plug, consumables, pregnancy/disease/implant cautions.

Use explicit eligibility states:
- recommendation_ready
- insufficient_data
- verification_required
- regulatory_review_required
- safety_hold
- out_of_stock
- unavailable_in_country

## 7. Core skincare journey

Complete and connect:
questionnaire/input
→ optional manual 3-angle photos
→ structured type/concern/sensitivity/location/duration/recurrence/triggers/current products/red flags
→ recommended and avoid ingredients with reasons
→ cosmetics-manageable scope
→ real Korean product Top 3–5
→ Organic score and matching reasons
→ cautions and usage
→ retailer, price, currency, stock, shipping
→ morning/evening/weekly routine
→ save results and routine
→ 3/7/15/30-day follow-up
→ change recording
→ routine adjustment
→ professional escalation when needed

Do not output only one-word labels such as “redness” or “dryness.”

Never present medical diagnosis.

Prioritize professional guidance for pain, discharge, bleeding, severe inflammation, sudden worsening, widespread rash, serious allergy signals, suspected infection, severe hair loss, acute nail changes, or prolonged non-improvement.

## 8. Camera and privacy

- keep manual 3-angle capture as default
- keep NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE OFF
- do not re-enable auto-landmark capture by default
- preserve Android manual capture
- preserve truthful messaging that photo pixels are not sent to external AI under the current flow
- do not claim unimplemented AI photo diagnosis
- align consent, storage, deletion, and retention behavior
- separate original photos, derivatives, and analysis records
- support deletion and avoid long-term storage without consent
- use dynamic import/lazy loading for heavy camera/landmark code when useful
- prevent SSR/hydration/browser-API errors
- provide stable fallbacks and avoid layout shift

Do not stop after only a performance ticket.

## 9. Product data model

Use separate entities or schemas for:
- common product
- brand
- taxonomy/category
- category-specific attributes
- variants/options/shades
- retailer/offer/price/stock
- ingredients/materials/fragrance notes
- images/videos/usage media
- source and collection records
- field-level verification
- duplicate/reformulation relationships
- Organic recommendation metadata
- Affiliate/Sponsored metadata

Support common fields including:
canonical and display brand/product names, regulatory category, usage, warnings, targets/exclusions, country/manufacturer/distributor, size/unit/quantity, variants/shades/barcode/model, release/discontinued/reformulation status, URLs/media, ingredients/allergens/fragrance/certification/claims, collection/verification/refresh timestamps, source confidence, field verification, duplicate group, review status, recommendation eligibility, data completeness.

Do not force everything into one giant products table.

Preserve existing DB compatibility. Never apply Production migration. It is acceptable to create migration drafts, types, fixtures, validators, dry-runs, self-tests, and SELECT-only checks.

## 10. Automated product-data pipeline

Build or strengthen an automation-first pipeline:

candidate discovery
→ raw source preservation
→ source identification
→ brand normalization
→ product normalization
→ category classification
→ size/option/shade/fragrance extraction
→ ingredient/material/note/device-spec extraction
→ image/video/usage-media normalization
→ retailer/price/currency/stock normalization
→ country/shipping normalization
→ dedupe
→ variant/refill/set/package/reformulation/domestic-export distinction
→ source confidence
→ field-level verification
→ completeness score
→ recommendation eligibility
→ Staging candidate generation
→ manual-review reasons
→ refresh scheduling
→ change detection for price, stock, discontinuation, reformulation, media, and specs

Separate common pipeline stages from category extractors:
skincare, base makeup, color makeup, mascara, lip, hair/scalp, body, nail, fragrance, tool, device.

Administrators should review exceptions, not manually enter every product.

## 11. Sources and adapters

Support adapters for:
- Korean brand/manufacturer official sources
- Olive Young
- Naver Shopping
- Coupang
- domestic marketplaces and beauty retailers
- overseas K-Beauty retailers
- official APIs
- partner feeds
- CSV/JSON/XML feeds
- structured data
- search-based candidate discovery
- approved admin data
- public product data

Do not require official sources for initial discovery. Use higher-trust or official sources for critical verification such as exact names, ingredients, functional claims, usage, warnings, reformulation, shade options, device specs, certification.

On source failure, record structured states and switch sources:
rate_limited, blocked, authentication_required, robots_restricted, captcha_required, timeout, connection_reset, invalid_response, source_changed, unavailable, parsing_failed.

Never:
- bypass CAPTCHA or login
- use personal accounts
- violate robots/terms
- make paid API calls without approval
- hardcode secrets
- store sessions/cookies/tokens

When keys are required, implement only interface, env names, schemas, fixture, tests, rate-limit/error handling, and docs.

## 12. Normalization and dedupe

Normalize Korean/English names, aliases, spacing, punctuation, company vs brand, sub-brands, official names, units, sets, refill/full-size/mini/gifts, options, shades, fragrance, device models, old/new packaging.

Distinguish:
- identical product across retailers
- size variants
- shade variants
- refill vs full product
- single vs set
- packaging refresh
- ingredient-changing reformulation
- domestic vs export version
- similar names from different lines
- device/tool color or size options

Dedupe outputs:
confidence, match_reasons, conflicting_fields, duplicate_type, canonical candidate, manual_review_required.

Never auto-merge low-confidence duplicates.

## 13. Safety and regulation

Separate:
general cosmetics, functional cosmetics, quasi-drugs, consumer goods, supplements, medical devices, medical-device-unknown, professional/salon products, regulatory-review-required.

Avoid claims such as cure, diagnose, guaranteed effect, or photo-based disease determination.

Use cautious wording:
may help, may fit the stated goal, product information claims, individual results vary, stop if irritation occurs, seek professional advice if symptoms persist.

For beauty devices maintain:
mechanism, area, frequency, intensity, contraindications, pregnancy/disease/implant cautions, device status, certification, voltage/plug, consumables, manual source.

## 14. Real recommendation output

For skincare Top 3–5 show:
- Organic score
- matched concerns and ingredients
- reason
- cautions
- texture and routine step
- usage/frequency
- retailer, price, currency, stock, shipping country
- verification date and level
- affiliate/sponsored disclosure

Never place zero-score or no-evidence products in top recommendations.
Affiliate status must never affect Organic score.

Use category-specific reasons for mascara, lip, shampoo, fragrance, devices, etc.
Show explicit verification/data gaps rather than inventing information.

## 15. Usage, routines, saving, and follow-up

Connect products to:
- verified usage text/media
- morning/evening/weekly skincare routines
- makeup combinations and removal
- hair/scalp sequence
- body/nail/fragrance/tool/device usage and cautions

Do not autoplay videos. Do not attach unverified or wrong-product media.

Save and restore:
analysis, beauty profile, recommended/avoid ingredients, recommended/excluded/saved products, routines, makeup combinations, usage start/stop, satisfaction, irritation, progress, photo-comparison state, reassessment dates, follow-up schedule, professional-guidance state.

Preserve old local data through schema versioning/migration/fallback where possible.

Follow-up:
- day 3: use, early irritation, usage problems
- day 7: adaptation and continuation
- day 15: initial changes and adherence
- day 30: reassessment, maintain/replace/stop/escalate

Support outcomes:
improved, slightly improved, unchanged, slightly worse, worse, stopped, irritation, suspected allergy, not purchased, usage unclear, notes.

If real push/email/SMS infrastructure is absent, implement data model, schedule calculation, UI, opt-in, job creation point, failure/retry state only. Do not claim delivery is complete.

## 16. Professional guidance

Create symptom-based professional routing:
acne, redness/vascular, sensitivity, pigmentation, scarring, allergy, hair loss/scalp inflammation, nail changes, sudden changes, prolonged non-improvement.

Separate professional types:
dermatology, hair/scalp clinic, allergy care, dentistry, other relevant specialists.

Support institution data:
name, location/country, specialties, official/booking URL, languages, hours, source, verification date, affiliate/sponsored status.

Do not invent clinics.
Clearly disclose partnership/advertising.
Organic information and affiliate placements must remain separate.

## 17. Organic, affiliate, sponsored

Organic rank must not depend on:
advertising fee, commission, listing fee, margin, brand contract, campaign spend.

Keep separate fields for:
is_affiliate, is_sponsored, disclosure_label, partner, commission_type, campaign_id, organic_rank, sponsored_placement, affiliate_url, affiliate_verified_at.

Never create fake affiliate links.
Do not make ads look like recommendation reasons.

## 18. Country, language, currency, retailers

Maintain Korean-first product focus while supporting global users.

Manage:
access country, residence, shipping country, language, currency, retailer country, shipping coverage, country price/stock, customs/shipping-info availability, regional restrictions, regulation, voltage/plug, country-specific versions.

Retailer priority:
1. ships to user
2. in stock
3. valid price/currency
4. trusted retailer
5. recently verified
6. return/shipping info available
7. affiliate-independent Organic fit

If unavailable, show “no currently verified retailer” and make it refreshable rather than pretending purchase is possible.

## 19. Automatic refresh

Refresh:
price, currency, stock, URLs, images, shipping, names, packaging, reformulation, ingredients, shades/options, discontinuation, usage, media, certification, device specs, professional-institution information.

Support:
collected_at, verified_at, refresh_due_at, last_success_at, last_failure_at, failure_count, refresh_status, source_changed, manual_review_required.

Statuses:
current, refresh_due, refreshing, refresh_failed, source_unavailable, verification_required, stale_but_usable, blocked, discontinued.

Do not run arbitrary Production schedulers. It is acceptable to implement scheduler interfaces, queue payloads, selection logic, dry-runs, and tests.

## 20. Admin operations

Automation handles discovery, normalization, dedupe, classification, extraction, offer/media processing, verification status, Staging candidates, refresh candidates.

Admin reviews:
ambiguous duplicates, ingredient/name conflicts, reformulation, regulation, safety, wrong image/retailer, low confidence, affiliate disclosure, publication approval.

Keep manual single-product entry as a fallback, not the operational center.

## 21. Performance, accessibility, mobile

Ensure:
- mobile-first 320px and up
- long names and multilingual text
- camera-permission denial
- image failure fallback
- empty retailer state
- stable loading/skeleton
- keyboard/focus accessibility
- non-color-only states
- meaningful alt text
- text alternatives for media
- no excessive autoplay
- lazy-load heavy camera/landmark/chart/media modules
- SSR/browser API separation
- reduced client bundle
- usable results/routines on mobile

Do not add fake statistics, testimonials, or unsupported efficacy numbers.

## 22. Tests and verification

Run existing relevant tests and add/strengthen:
- recommendation pipeline
- user journey
- smoke
- guided capture
- photo comparison
- symptom safety
- routine and storage
- retailer/country/locale
- Organic score and usage-media regressions
- beauty taxonomy
- category classification
- common product model
- category attributes
- mascara recommendation
- lip-shade suitability
- shampoo/scalp recommendation
- fragrance attributes
- device safety gate
- regulatory separation
- brand/product normalization
- dedupe/variant/reformulation
- Organic/Affiliate/Sponsored separation
- follow-up schedules
- professional escalation
- refresh selection
- secret scanning
- TypeScript
- lint
- production build
- git diff --check

Fix test/build failures and rerun when safe.
Do not claim Preview, real-device, external-service, or Production verification from automated tests alone.

## 23. Work style

- create an internal plan, then implement immediately
- do not stop after writing a plan
- do not ask small questions
- make reasonable assumptions and document them appropriately
- work in one substantial continuous bundle
- do not stop after one ticket
- prioritize real user flow and automation
- avoid documentation-only work
- avoid mock-only completion
- switch away from blocked sources
- preserve secrets and existing work
- clearly separate actual completion from foundations and unverified external work

If everything cannot be completed, prioritize:
1. skincare journey
2. long-term beauty profile
3. full taxonomy
4. common/extensible product model
5. automation pipeline
6. representative mascara/lip/shampoo logic
7. Organic/Affiliate separation
8. professional escalation
9. follow-up
10. global retailer foundation

## 24. Git and environment rules

Allowed:
- read/modify current feature branch
- create code/tests/fixtures/docs
- local tests/lint/typecheck/build
- safe dry-run and SELECT-only checks
- git add only explicit changed paths
- meaningful commits
- push current feature branch

Forbidden:
- git add .
- git add -A
- git clean
- git reset --hard
- git checkout -- .
- git restore
- git stash
- force push
- unauthorized deletion
- edit/merge main
- Production deploy
- Production DB/Storage/environment writes
- destructive DB operations
- paid APIs
- external login
- CAPTCHA bypass
- high-risk scraping
- secret output/storage
- commit .env/service-role/user personal data

## 25. Documentation

Update only actual outcomes in:
- MASTER_PLAN.md when compatible and minimally necessary
- PROJECT_STATUS.md
- ROADMAP.md
- CHANGELOG.md
- relevant docs

Distinguish:
- foundation complete
- user-facing complete
- real recommendation available
- data structure only
- Preview/device/external-data unverified

Keep main unmerged, Production undeployed, and Production DB unchanged.

## 26. Minimum completion criteria

At minimum:
1. skincare input → structured state → ingredients → real products → usage → routine → save → follow-up is connected in code
2. red flags escalate before product recommendation
3. long-term profile structure exists
4. extensible full-beauty taxonomy exists
5. mascara, lipstick/lip, and shampoo/scalp attributes and recommendation logic exist
6. cosmetics/devices/tools/fragrance/regulated items are separated
7. common model and category attributes are separated
8. collection/normalization/dedupe/verification/refresh pipeline is category-extensible
9. Organic/Affiliate/Sponsored separation exists
10. symptom-based professional guidance exists
11. 3/7/15/30 follow-up exists
12. country/language/currency/retailer structure is maintained or improved
13. relevant tests and production build pass
14. unconnected external data/services are reported honestly
15. main and Production remain untouched

Do not fake complete UI/data for every category. Build a strong extensible foundation while completing the core skincare flow and representative categories.

## 27. Final report format

Report only:
1. initial repository state
2. completed user flow
3. long-term profile result
4. taxonomy and included groups
5. categories actually recommendation-ready
6. categories with structure only
7. mascara/lipstick/shampoo implementation
8. collection/normalization/dedupe/verification/refresh automation
9. usage/media/routine result
10. follow-up result
11. professional guidance result
12. Organic/Affiliate/Sponsored separation
13. country/language/currency/retailer result
14. changed/created files
15. tests and results
16. lint/typecheck/build results
17. remaining real-data/external/Preview/device checks
18. incomplete items and reasons
19. commits and hashes
20. push result
21. next single largest work bundle
22. confirmation that main, Production, Production DB/Storage/environment were untouched

Do not stop for ordinary progress reports or small approvals.
Continue until the safe workspace-scoped bundle is complete or a truly fatal blocker occurs.
