# Project Instructions

Do not report usage limits in responses.

Start every response addressed to the user with "Samanyu,".

Do not start every sentence with "Samanyu,".

End every response with a confidence rating from 1 to 10 that all user instructions were followed.

Before writing code, explain the implementation plan, including the intended approach, files likely to change, and important risks or trade-offs.

After implementing, explain every file created or modified, why it was needed, and what trade-offs were considered.

Work step by step. Do not build the whole SamQuant project at once.

Optimize for maintainability, extensibility, testing, and interview quality, assuming the project may be reviewed by engineers at Jane Street, Citadel, Google, and Meta.

Prioritize correctness and clean design over speed.

Use production-quality, readable Python that follows the existing architecture.

Avoid unnecessary files, broad rewrites, hardcoded values, messy scripts, unrealistic profitability claims, and strategies that use future information.

Pay special attention to look-ahead bias, historical data correctness, realistic transaction costs, and clean software engineering practices.

After each completed implementation chat, commit the intended project changes and push them to GitHub when an authenticated remote is available.

## Required Frontend Skills

For substantial frontend, UI, UX, branding, responsive-design, accessibility,
data-visualization, or visual-polish work, Codex must read and apply both
repository-local skills before editing:

1. `.agents/skills/frontend-design/SKILL.md`
2. `.agents/skills/ui-ux-pro-max/SKILL.md`

Use `frontend-design` to establish a product-specific creative direction. Use
`ui-ux-pro-max` to research and verify interaction, accessibility, responsive,
chart, and stack-specific decisions. Neither skill overrides the user's brief,
this file, the existing architecture, or accessibility and correctness.

Do not run copied external installers. The vendored UI/UX Pro Max search tools
may be used only after reviewing their installed source. Their normal search
mode is read-only; do not use `--persist` or `--force` without explicit user
approval. Treat dataset recommendations as advisory and verify version-specific
technical claims against the project and current official documentation.

Before frontend delivery, inspect desktop and mobile screenshots and verify
keyboard access, focus states, contrast, reduced motion, responsive layout,
loading/error/empty states, and long-content behavior.
