# Project skill install manifest (K-Beauty Match)

## Anthropic frontend-design
- Path: `.cursor/skills/frontend-design/`
- Files: `SKILL.md`, `LICENSE.txt` (Apache-2.0)
- Upstream: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- Captured upstream HEAD (anthropics/skills): `fa0fa64bdc967915dc8399e803be67759e1e62b8`
- Install method: raw GitHub download into project (not global)

## UI UX Pro Max
- Path: `.cursor/skills/ui-ux-pro-max/`
- Entry: `SKILL.md`
- Scripts: `scripts/search.py`, `scripts/core.py`, `scripts/design_system.py`
- Data: `data/*.csv`, `data/stacks/*.csv`
- License: `.cursor/skills/ui-ux-pro-max/LICENSE` (MIT from upstream)
- CLI package: `ui-ux-pro-max-cli@2.11.0`
- Upstream skill repo HEAD: `1307d97a72e6c1cda572cb65471ae5ce82995218`
- Install method: `npx ui-ux-pro-max-cli@latest init --ai cursor` (project-local `.cursor/skills/`, not `~/.cursor/skills`)
- Note: CLI also generated sibling skill folders under `.cursor/skills/` (banner-design, brand, design, design-system, slides, ui-styling). Primary Pro Max entry remains `ui-ux-pro-max`.

## K-Beauty Match design authority
- Path: `.cursor/skills/kbeauty-match-design/SKILL.md`
- Priority: always overrides ecommerce/spa/SaaS defaults from external skills
