# SamQuant Web Design System

## Direction

SamQuant uses a split register. Public explanations sit on warm research paper. The working terminal uses graphite surfaces built for dense financial data. One steel-blue market line links data, strategy, execution, portfolio state, and risk.

## Typography

- Barlow Condensed: headlines and the SamQuant wordmark
- IBM Plex Sans: interface and editorial text
- IBM Plex Mono: prices, dates, metrics, and system status

All three font families are self-hosted from Fontsource packages licensed under SIL Open Font License 1.1.

## Color Tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Paper | `#f1efe8` | Public narrative background |
| Ink | `#111310` | Primary type and strongest contrast |
| Graphite | `#202421` | Research and analytics surfaces |
| Steel | `#727a76` | Secondary information |
| Interaction | `#486a73` | Links, focus, and the continuous line |
| Gain | `#247653` | Purchases and positive states only |
| Loss | `#b64a43` | Sales, drawdown, and errors only |

## Asset Plan

The project needs no photography or decorative illustration. Its real deterministic charts are the visual material.

- SQ mark: a circular quantitative boundary, an internal S path, and a Q tail
- Light and dark wordmarks: navigation, documentation, and repository use
- Browser and PWA icons: simplified SQ mark at 16 to 512 pixels
- Social previews: the real bundled demonstration series behind the SamQuant message

Run `npm run assets:brand` inside `web/` to reproduce every raster brand asset from the deterministic demo report.

## Motion

The landing page has four motion sequences: raw line reveal, strategy interpretation, order execution, and portfolio analytics. As each visualization enters the viewport, it rises, sharpens, and scales into place before its data is drawn. Mobile uses shorter travel and less blur. Reduced-motion users receive the complete static diagrams. Scrolling remains native and no section is pinned.

## Responsive Rules

- `1440px`: full editorial measure and persistent terminal rail
- `1024px`: reduced gutters and compact metrics
- `768px`: controls move above the terminal and become collapsible
- `375px`: two-column metrics, stacked execution, and simplified charts

Touch controls remain at least 40 pixels tall. Dense tables scroll within their own labeled region without widening the page.
