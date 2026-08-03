# SamQuant Web Quality Report

Verified on August 3, 2026.

## Scope

The review covered the public narrative, research terminal, professional pages, API proxy, brand assets, and the existing Python research engine. The browser matrix used exact widths of 375, 768, 1024, and 1440 pixels.

## Automated Results

| Check | Result |
| --- | --- |
| Python tests | 86 passed |
| Python coverage | 90.02%, above the 85% gate |
| Ruff | Passed |
| Frontend unit and API tests | 11 passed |
| Playwright | 40 passed, 12 intentional project skips |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Next.js production build | Passed, 19 static or dynamic routes |
| Axe WCAG audit | No serious or critical findings |
| npm production audit | 0 known vulnerabilities |

The Playwright suite checks the primary backtest journey, invalid dates, empty tickers, loading, unavailable Python service, route completeness, scroll-driven visualization motion, reduced motion, responsive overflow, accessibility, local web vitals, and desktop visual baselines.

## Performance

The production bundle remains inside all enforced budgets.

| Budget | Limit | Measured |
| --- | ---: | ---: |
| Largest compressed JavaScript chunk | 220 KB | 71.0 KB |
| Total compressed JavaScript chunks | 900 KB | 307.2 KB |
| Bundled deterministic data | 400 KB | 341.8 KB |

Local Chromium measurements against the optimized build are diagnostic, not real-user field data.

| Route | Viewport | LCP | CLS |
| --- | --- | ---: | ---: |
| `/` | 1440px | 144 ms | 0.0018 |
| `/research` | 1440px | 56 ms | 0.0033 |
| `/` | 375px | 40 ms | 0.0061 |
| `/research` | 375px | 40 ms | 0.0199 |

## Accessibility

- Semantic headings, landmarks, forms, tabs, tables, and status regions
- Visible keyboard focus and a skip link
- Text summaries for financial charts
- A collapsible table with recent chart values
- Labels alongside gain, loss, buy, and sell colors
- Static content when reduced motion is requested
- Touch-sized mobile navigation and controls

Automated checks cannot replace testing with several screen readers and disabled users. That broader review remains useful before a high-traffic release.

## Responsive Review

Real full-page captures live under `docs/images/web/` for the homepage, terminal, and architecture page at every required width. Every public route was also checked for horizontal overflow in each browser project.

## Trust Review

The site has no account system, forms, custom analytics, advertising, tracking cookies, browser storage, or external error-monitoring SDK. Backtest controls are sent to the local API and are not persisted by SamQuant. Browser downloads are created locally.

Public demonstrations use bundled synthetic data. Local Yahoo Finance access remains opt-in because public redistribution rights are not assumed. TradingView Lightweight Charts keeps its required attribution visible.

## Remaining Limits

- Performance numbers are local laboratory measurements, not production field data.
- The chart library renders to canvas, so the nearby summary and table carry the accessible alternative.
- Version 1 does not model partial fills, market impact, taxes, or point-in-time universes.

## Design Self-Evaluation

| Pillar | Score | Evidence |
| --- | ---: | --- |
| Point of view | 9.4 | One market line becomes data, signal, execution, and risk |
| Typography | 9.2 | Self-hosted editorial, interface, and numeric font roles |
| Colour | 9.2 | Warm paper and graphite with strictly semantic gain and loss colors |
| Hierarchy | 9.3 | Charts lead while controls and assumptions remain quiet |
| Imagery | 9.1 | Real deterministic charts replace stock or decorative imagery |
| Copy | 9.2 | Specific educational language without performance claims |
| Motion | 9.0 | Four explanatory sequences with native scrolling and a static alternative |
| Mobile and invisible finish | 9.2 | Purpose-built control flow, no overflow, tested states, and accessible alternatives |

## Version 2 Recommendations

- Add opt-in privacy-preserving field performance monitoring after deployment.
- Complete a manual screen-reader review with VoiceOver and NVDA users.
- Add walk-forward analysis and point-in-time asset universes before deeper strategy claims.
- Consider paper trading only after introducing credentials, rate limits, and an execution safety model.
