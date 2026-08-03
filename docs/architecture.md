# SamQuant Architecture

## System Flow

```mermaid
flowchart TD
    DATA["Market Data<br/>samquant/data"]
    STRATEGY["Strategies<br/>samquant/strategies"]
    ENGINE["Trading Engine<br/>samquant/engine"]
    ANALYTICS["Analytics<br/>samquant/analytics"]
    APPLICATION["Application Service<br/>samquant/application"]
    API["HTTP Boundary<br/>samquant/api"]
    STREAMLIT["Prototype UI<br/>samquant/dashboard"]
    WEB["Public Product<br/>web/"]

    DATA -->|validated OHLCV frames| STRATEGY
    STRATEGY -->|daily target weights| ENGINE
    DATA -->|next-open and closing prices| ENGINE
    ENGINE -->|equity, cash, positions, trades| ANALYTICS
    ANALYTICS -->|performance summary| APPLICATION
    ENGINE -->|simulation details| APPLICATION
    APPLICATION --> API
    APPLICATION --> STREAMLIT
    API -->|typed JSON| WEB
```

## Module Responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| `data` | Downloading, schema normalization, validation, CSV caching | Signals or trading decisions |
| `strategies` | Converting historical closes into target portfolio weights | Orders, fees, fills, or metrics |
| `engine` | Delayed execution, orders, cash, positions, fees, slippage, valuation | Data downloading or strategy rules |
| `analytics` | Validated calculations from completed backtest results | Signal generation or trade execution |
| `application` | Research use cases shared by every interface | HTTP or visual presentation |
| `api` | Request validation, bounded access, and JSON serialization | Financial calculations |
| `dashboard` | Streamlit controls, charts, and tables | A second copy of domain logic |
| `web` | Product pages, research controls, and financial visualization | Signals, execution, or metrics |

This dependency direction keeps the financial rules testable without starting
Streamlit. A strategy can be replaced without changing accounting, and the user
interface can be replaced without rewriting research logic.

## Decision-To-Execution Timeline

```mermaid
sequenceDiagram
    participant D as Market data
    participant S as Strategy
    participant B as Backtester
    participant P as Portfolio

    D->>S: Bar t closes
    S->>B: Target weight decided for t
    Note over B: Shift target by one row
    D->>B: Bar t+1 opens
    B->>P: Execute sells, then buys
    P-->>B: Updated cash, positions, and trades
    D->>B: Bar t+1 closes
    B->>B: Mark portfolio at closing prices
```

The strategy may use bar `t`'s close because execution cannot occur until the
next bar opens. It cannot use any value from `t+1` when making the decision.

## Important Design Decisions

### Target weights are the strategy-engine contract

Strategies describe desired exposure instead of creating orders. This keeps
signal research independent from commissions, available cash, and execution
rules. A future strategy only needs to return an aligned `DataFrame` of weights.

### Accounting has one owner

`Portfolio` is the only class that mutates cash and positions. Orders and trades
are immutable records, which makes executions easier to audit and test.

### Data is strict at domain boundaries

OHLCV frames must be non-empty, chronological, unique, numeric, complete, and
internally consistent. Provider-specific incomplete rows are removed only at the
download boundary; downstream modules continue to reject malformed inputs.

### Execution is intentionally conservative

The engine is long-only, fully invested at most, executes sales before purchases,
caps buys to available cash, and applies adverse slippage. Fractional quantities
keep Version 1 accounting deterministic and focused.

### Interfaces are adapters

`application/backtest.py` coordinates the domain layers. Streamlit imports that
service, while FastAPI validates requests and serializes results for Next.js.
The browser renders typed output and never recalculates financial values.

### Public data access is conservative

The public site bundles a deterministic result produced by the Python engine.
Yahoo Finance access is disabled in FastAPI unless
`SAMQUANT_ENABLE_YAHOO=true` is set for local research. This avoids presenting
provider data as licensed public redistribution.

## Web Performance Budgets

The web build fails when one gzip-compressed JavaScript chunk exceeds 220 KB,
all chunks exceed 900 KB, or bundled demonstration data exceeds 400 KB. Browser
tests cover WCAG violations, responsive overflow, reduced motion, and the main
backtest journey.

## Current Boundaries

Version 1 assumes aligned daily bars, a user-selected universe, complete fills,
and no short selling or leverage. Point-in-time universes, corporate-action cash
flows, market impact, partial fills, and broker connectivity belong in Version 2.
