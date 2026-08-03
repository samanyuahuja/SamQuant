---
name: ui-ux-pro-max
description: Use a repository-local UI and UX knowledge base for interface planning, accessibility, responsive behavior, interaction, charts, and stack-specific review. Use for substantial frontend, UI, UX, branding, responsive-design, accessibility, visual-polish, and data-visualization work.
license: MIT; complete terms in LICENSE
---

# UI/UX Pro Max

> Modified Codex adaptation for SamQuant, based on Next Level Builder's
> `ui-ux-pro-max` skill at commit
> `14ddef5c05e52d7c253b8f0129de7bcd1045ae5b`.
> Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
> Modified: 2026-08-03.

Use the local searchable database as design research, not as an authority. The
user's brief, repository rules, existing design system, accessibility needs,
and current official framework documentation take precedence over a result.

## When To Apply

Use this skill for new pages, interface restructuring, components, color,
typography, responsive layout, forms, navigation, animation, charts,
accessibility, or a visual-quality review. Skip it for backend-only work.

## Priority Order

Review decisions in this order:

1. Accessibility
2. Touch and interaction
3. Performance
4. Product-appropriate style
5. Layout and responsive behavior
6. Typography and color
7. Animation
8. Forms and feedback
9. Navigation
10. Charts and data communication

Load `references/quick-reference.md` for the full checklist and
`references/pro-rules.md` for the final polish pass.

## Local Tool Safety

The installed Python tools use the standard library and local CSV files. They
do not need network access or package installation. Still follow these rules:

- Read a script before executing it when its installed revision changes.
- Do not use `--persist` or `--force` without explicit user approval because
  those flags write design-system files into the repository.
- Do not install packages, fonts, assets, or CDN scripts merely because a
  database row suggests them.
- Treat version-specific framework advice as potentially stale. Verify it
  against the project's installed version and official documentation.
- Treat generated palettes and style matches as candidates to critique.
- Never paste executable examples from CSV data without reviewing them.

## Resolve The Skill Path

Run commands from any working directory by resolving the repository root:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
SKILL_DIR="$REPO_ROOT/.agents/skills/ui-ux-pro-max"
```

## Workflow

### 1. Inspect The Product

Determine the product type, audience, visual brief, existing component system,
and actual frontend stack from repository files. Do not assume a stack.

### 2. Search For A Starting Point

For a substantial new interface, run the reviewed read-only search without
`--persist`:

```bash
python3 "$SKILL_DIR/scripts/search.py" \
  "quantitative research trading dashboard precise data-dense" \
  --design-system -p "SamQuant" --variance 7 --motion 4 --density 8
```

Change the query and dials to match the user's brief. If there is no database
match, broaden the query once. Do not pretend an empty result is a match.

### 3. Search Specific Domains

Use targeted searches only when they help a real decision:

```bash
python3 "$SKILL_DIR/scripts/search.py" "financial time series comparison" --domain chart
python3 "$SKILL_DIR/scripts/search.py" "keyboard focus error feedback" --domain ux
python3 "$SKILL_DIR/scripts/search.py" "rendering data dashboard" --stack nextjs
```

Supported domains are `style`, `color`, `chart`, `landing`, `product`, `ux`,
`typography`, `google-fonts`, `icons`, `gsap`, `react`, and `web`. Stack data is
stored under `data/stacks/`.

### 4. Synthesize, Do Not Copy

Compare search output with the `frontend-design` direction. Keep only choices
that fit SamQuant's audience, content, architecture, and constraints. Resolve
conflicts in this order:

1. User request
2. Root `AGENTS.md`
3. Existing product architecture and design conventions
4. Accessibility and correctness
5. `frontend-design` product-specific direction
6. UI/UX Pro Max database suggestions

### 5. Verify The Result

Inspect desktop and mobile screenshots. Check keyboard access, focus visibility,
contrast, reduced motion, touch targets, long content, loading/error/empty
states, chart readability, layout stability, and responsive behavior.

## Validation Commands

These commands are local and do not modify product files:

```bash
python3 "$SKILL_DIR/scripts/validate_data.py"
python3 -m unittest discover -s "$SKILL_DIR/scripts/tests" -p "test_*.py"
```

