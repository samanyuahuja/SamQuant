# SamQuant Web Design System

## Direction

SamQuant uses one warm research-paper system across its explanations and working interface. The Research page borrows its hierarchy from an analyst's notebook: define the experiment, inspect price and fills, read the metrics, then examine supporting results. Real market charts provide the visual identity.

## Visual Hierarchy

Charts carry the visual weight. Section labels provide quiet orientation, headings explain one idea, and supporting text stays secondary. Dividers appear only inside real data tools or where they communicate sequence. Decorative grids, persistent guide lines, repeated state jargon, and ornamental rules are intentionally excluded.

## Typography

- Barlow Condensed: headlines and the SamQuant wordmark
- IBM Plex Sans: interface and editorial text
- IBM Plex Mono: prices, dates, metrics, and system status

All three font families are self-hosted from Fontsource packages licensed under SIL Open Font License 1.1.

## Color Tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Paper | `#f1efe8` | Public narrative background |
| Research paper | `#f4f1e9` | Backtest workspace background |
| Research surface | `#fffdf8` | Financial chart canvas |
| Ink | `#111310` | Primary type and strongest contrast |
| Muted ink | `#525e57` | Secondary research information |
| Interaction | `#315f69` | Links, focus, and chart series |
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

The landing page has four motion sequences: raw line reveal, strategy interpretation, order execution, and portfolio analytics. Each visualization rises and scales into place before its data is drawn. Mobile uses shorter travel. Reduced-motion users receive the complete static diagrams. Scrolling remains native and no section is pinned.

## Responsive Rules

- `1440px`: wide analysis canvas and three-column experiment setup
- `1024px`: two-column setup and compact metric wrapping
- `768px`: single-column setup behind an explicit disclosure
- `375px`: two-column metrics, touch-sized inputs, and simplified chart tabs

Touch controls remain at least 44 pixels tall. Dense tables scroll within their own labeled region without widening the page.
