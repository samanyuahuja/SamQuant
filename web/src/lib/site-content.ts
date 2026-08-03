export interface ContentSection {
  title: string;
  body: string[];
  points?: string[];
  code?: string;
  links?: { label: string; href: string }[];
}

export interface ContentPage {
  title: string;
  eyebrow: string;
  summary: string;
  sections: ContentSection[];
}

export const CONTENT_PAGES: Record<string, ContentPage> = {
  methodology: {
    title: "Methodology",
    eyebrow: "Research rules",
    summary: "Every result follows an explicit timeline, cost model, and set of limits.",
    sections: [
      {
        title: "Decision timeline",
        body: [
          "A strategy reads data through a completed daily close. Its target shifts forward one bar before execution, so Monday's decision can first trade at Tuesday's open.",
          "This delay prevents a strategy from trading at a price that was already known only after the decision was made.",
        ],
      },
      {
        title: "Execution assumptions",
        body: [
          "The engine models commission, fixed fees, and adverse slippage. Orders fill completely at the adjusted next-open price.",
        ],
        points: [
          "Long-only positions",
          "No borrowed cash",
          "Sells execute before buys",
          "Daily closing valuation",
        ],
      },
      {
        title: "Known limits",
        body: [
          "The simulator does not model taxes, bid-ask spreads, volume limits, latency, partial fills, or market impact. A chosen symbol list can also create survivorship bias.",
          "Strategy examples are engineering demonstrations, not evidence of a profitable trading edge.",
        ],
      },
    ],
  },
  docs: {
    title: "Documentation",
    eyebrow: "Use SamQuant",
    summary: "Run the Python engine, Streamlit prototype, API, or research terminal locally.",
    sections: [
      {
        title: "Install",
        body: ["SamQuant supports Python 3.10 or newer and Node.js 20.9 or newer."],
        code: "python3 -m venv .venv\nsource .venv/bin/activate\npip install -r requirements-dev.txt\ncd web && npm install",
      },
      {
        title: "Start both services",
        body: ["The web route handler forwards backtest requests to the local Python API."],
        code: "python -m uvicorn samquant.api.app:app --reload\ncd web && npm run dev",
      },
      {
        title: "Reference guides",
        body: ["The repository includes module contracts, architecture decisions, and detailed usage notes."],
        links: [
          { label: "Python API", href: "https://github.com/samanyuahuja/SamQuant/blob/main/docs/api.md" },
          { label: "Usage guide", href: "https://github.com/samanyuahuja/SamQuant/blob/main/docs/usage.md" },
        ],
      },
    ],
  },
  architecture: {
    title: "Architecture",
    eyebrow: "Clear boundaries",
    summary: "Each layer owns one job and exposes a small, testable interface.",
    sections: [
      {
        title: "System flow",
        body: ["Validated bars become strategy targets, delayed orders, portfolio history, and risk metrics."],
        points: ["Market data", "Strategies", "Execution engine", "Portfolio", "Analytics", "Interfaces"],
      },
      {
        title: "One source of truth",
        body: [
          "The Next.js application renders typed API results. It does not calculate financial metrics or strategy signals.",
          "Streamlit and FastAPI share the same application service, which keeps their behavior aligned.",
        ],
      },
      {
        title: "Extension points",
        body: [
          "A new strategy returns target weights and indicators. The engine remains unchanged because it depends on targets rather than a concrete strategy class.",
        ],
      },
    ],
  },
  about: {
    title: "About",
    eyebrow: "The project",
    summary: "SamQuant is an educational trading system built by Samanyu Ahuja.",
    sections: [
      {
        title: "Why it exists",
        body: [
          "The project studies how software architecture, historical simulation, and quantitative reasoning fit together.",
          "It favors visible assumptions and testable behavior over claims about future returns.",
        ],
      },
      {
        title: "Technology",
        body: ["Python owns the research engine. Next.js provides the public product experience."],
        points: ["pandas and NumPy", "FastAPI", "Next.js and TypeScript", "GSAP", "Lightweight Charts", "pytest and Playwright"],
      },
      {
        title: "Source",
        body: ["The complete project is public under the MIT License."],
        links: [{ label: "View GitHub", href: "https://github.com/samanyuahuja/SamQuant" }],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    eyebrow: "Plain language",
    summary: "SamQuant has no accounts, forms, advertising, or custom analytics in version 1.",
    sections: [
      {
        title: "Backtest inputs",
        body: [
          "Ticker symbols and settings are sent to the SamQuant API to run the requested backtest. The application does not store them in a database.",
          "Downloaded CSV files stay in your browser unless you choose to share them.",
        ],
      },
      {
        title: "Infrastructure logs",
        body: [
          "A hosting provider may temporarily record standard request details such as IP address, browser type, time, and requested path for security and operations.",
        ],
      },
      {
        title: "Cookies",
        body: ["The current site does not set tracking cookies or use external error monitoring."],
      },
    ],
  },
  terms: {
    title: "Terms",
    eyebrow: "Research use",
    summary: "Use SamQuant for education, research, and software evaluation.",
    sections: [
      {
        title: "No trading service",
        body: [
          "SamQuant does not place live orders, hold customer funds, manage accounts, or provide personalized financial advice.",
        ],
      },
      {
        title: "Your responsibility",
        body: [
          "You are responsible for checking results, respecting data-provider terms, and deciding whether any research method fits your purpose.",
        ],
      },
      {
        title: "Software license",
        body: ["The source code is provided under the MIT License without a warranty."],
        links: [{ label: "Read license", href: "https://github.com/samanyuahuja/SamQuant/blob/main/LICENSE" }],
      },
    ],
  },
  disclaimer: {
    title: "Financial disclaimer",
    eyebrow: "Read before using results",
    summary: "SamQuant is educational software, not investment advice or a trading recommendation.",
    sections: [
      {
        title: "Hypothetical performance",
        body: [
          "Backtested performance is hypothetical. Historical results do not represent live trading, and past performance does not guarantee future results.",
        ],
      },
      {
        title: "Model assumptions",
        body: [
          "Results depend on data quality, selected dates, parameters, signal timing, and execution assumptions. Real fees, slippage, taxes, liquidity, and fills may differ substantially.",
        ],
      },
      {
        title: "No recommendation",
        body: [
          "Nothing on this site is a recommendation to buy, sell, or hold a security. Consider qualified professional advice before making financial decisions.",
        ],
      },
    ],
  },
  "data-and-attribution": {
    title: "Data and attribution",
    eyebrow: "Sources and licenses",
    summary: "The public demonstration uses deterministic synthetic data generated by SamQuant.",
    sections: [
      {
        title: "Demonstration data",
        body: [
          "Demo prices are repeatable synthetic OHLCV bars. They let anyone inspect the interface without presenting invented market performance as historical fact.",
        ],
      },
      {
        title: "Yahoo Finance",
        body: [
          "Local users may enable Yahoo Finance downloads for personal research. Review Yahoo's terms before public redistribution or commercial use.",
        ],
        links: [{ label: "yfinance terms note", href: "https://ranaroussi.github.io/yfinance/index.html" }],
      },
      {
        title: "Financial charts",
        body: ["Interactive financial charts use TradingView Lightweight Charts under Apache 2.0."],
        links: [{ label: "TradingView attribution", href: "https://www.tradingview.com/" }],
      },
    ],
  },
  accessibility: {
    title: "Accessibility",
    eyebrow: "Designed for access",
    summary: "SamQuant targets WCAG 2.2 AA across public pages and research controls.",
    sections: [
      {
        title: "Included support",
        body: ["The interface provides semantic landmarks, visible focus, keyboard controls, chart summaries, and responsive touch targets."],
        points: ["Skip navigation", "Reduced motion", "Text chart summaries", "Color-independent labels", "High contrast"],
      },
      {
        title: "Charts",
        body: ["Every chart includes a nearby text summary. Tables expose the same important financial values without requiring visual interpretation."],
      },
      {
        title: "Feedback",
        body: ["Accessibility issues can be reported through the public GitHub repository."],
        links: [{ label: "Open an issue", href: "https://github.com/samanyuahuja/SamQuant/issues" }],
      },
    ],
  },
  changelog: {
    title: "Changelog",
    eyebrow: "Version history",
    summary: "A concise record of research, engine, and interface changes.",
    sections: [
      {
        title: "1.1.0",
        body: ["Added the Next.js product site, FastAPI boundary, research terminal, and strategy indicator output."],
        points: ["Deterministic web demo", "Responsive terminal", "Typed API contract", "Accessible public pages"],
      },
      {
        title: "1.0.0",
        body: ["Completed the Python research engine, analytics, Streamlit dashboard, documentation, and production-readiness checks."],
      },
    ],
  },
};

export const CONTENT_SLUGS = Object.keys(CONTENT_PAGES);
