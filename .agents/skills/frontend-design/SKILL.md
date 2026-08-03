---
name: frontend-design
description: Create distinctive, intentional frontend design grounded in the product, audience, and task. Use for substantial frontend, UI, branding, responsive-design, accessibility, visual-polish, or interface-copy work.
license: Apache-2.0; complete terms in LICENSE.txt
---

# Frontend Design

> Modified Codex adaptation for SamQuant, based on Anthropic's `frontend-design`
> skill at commit `b29e7cf65e5cb78a5ac33d582270551bc74a14eb`.
> Source: https://github.com/anthropics/skills/tree/main/skills/frontend-design
> Modified: 2026-08-03.

Act as a design lead. Make choices that belong to this product instead of
reusing a fashionable template. The user's brief, repository conventions, and
accessibility requirements always outrank this skill.

## Ground The Direction

Before implementation, identify:

1. The concrete product and its subject matter.
2. The audience and usage context.
3. The screen's single most important job.
4. The product-specific visual material available: data, charts, instruments,
   workflows, objects, terminology, and real content.

For SamQuant, draw visual language from quantitative research and trading
workflows: price series, drawdowns, orders, positions, risk, timestamps, and
research comparison. Keep the interface credible and useful. Never imply
profitability or certainty that the system cannot support.

## Plan Before Building

Create a compact design direction before editing frontend code:

- **Color:** 4-6 named tokens with exact values and semantic roles.
- **Type:** display, body, and data/utility roles where useful.
- **Layout:** one clear composition, supported by a small ASCII wireframe when
  the screen is structurally complex.
- **Signature:** one memorable product-specific element.
- **Interaction:** the few motions or state changes that improve understanding.

Critique the plan against the brief. Replace choices that could fit almost any
SaaS dashboard. Spend visual boldness in one place and keep the rest disciplined.

## Design Principles

- Make the first viewport communicate the actual product immediately.
- Use structure to encode meaning, not as decoration.
- Treat typography as part of the identity while keeping dense data readable.
- Use real interface content and real states whenever available.
- Use motion to explain hierarchy, cause, or change. Respect reduced motion.
- Match implementation complexity to the direction.
- Preserve the application's established architecture and component patterns.
- Use concise, human interface copy that names what users recognize and control.

Avoid defaulting to generic AI aesthetics such as interchangeable gradient
heroes, decorative metric cards, arbitrary numbered sections, glass effects,
or a single neon accent on near-black. Any of these can be used only when the
brief and product make the choice defensible.

## Interface Copy

- Write from the user's side of the screen.
- Use active voice and concrete verbs: `Run backtest`, not `Submit`.
- Keep action names consistent through buttons, progress, success, and errors.
- Make errors explain what happened and how to recover.
- Make empty states point toward a useful next action.
- Apply the repository's humanizer skill to longer visible copy when required.

## Quality Pass

Before delivery:

1. Capture and inspect desktop and mobile screenshots.
2. Verify real content, long labels, empty, loading, error, and disabled states.
3. Check keyboard focus, contrast, semantic structure, and reduced motion.
4. Remove decoration that does not support the brief.
5. Confirm the result does not overlap, clip, shift unexpectedly, or resemble a
   generic template.

