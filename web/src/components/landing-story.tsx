"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Code2, ShieldCheck } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { formatMoney, formatNumber, formatPercent, humanizeKey } from "@/lib/format";
import type { BacktestResponse, MetricValues, SignalRecord, StrategyId, TimeValue } from "@/lib/types";
import styles from "./landing-story.module.css";

gsap.registerPlugin(ScrollTrigger);

interface StrategyDemo {
  strategyLabel: string;
  indicators: Record<string, Record<string, TimeValue[]>>;
  signals: SignalRecord[];
  metrics: MetricValues;
}

type StrategyDemos = Record<StrategyId, StrategyDemo>;

const STRATEGY_COPY: Record<StrategyId, string> = {
  moving_average: "Two price averages cross. The target position changes.",
  mean_reversion: "A z-score finds prices far below their recent mean.",
  momentum: "Trailing returns rank assets before the leaders are selected.",
};

const STRATEGY_SHORT_LABEL: Record<StrategyId, string> = {
  moving_average: "Moving average",
  mean_reversion: "Mean reversion",
  momentum: "Momentum",
};

export function LandingStory({ report, strategyDemos }: { report: BacktestResponse; strategyDemos: StrategyDemos }) {
  const root = useRef<HTMLElement>(null);
  const [strategy, setStrategy] = useState<StrategyId>("moving_average");
  const symbol = report.metadata.symbols[0];
  const market = report.market[symbol];
  const closes = market.map((bar) => bar.close);
  const activeDemo = strategyDemos[strategy];
  const priceRange = range(closes);
  const pricePath = buildPath(closes, 1200, 480, 20);
  const activeIndicators = Object.entries(activeDemo.indicators).map(([name, symbols]) => ({
    name,
    values: symbols[symbol] ?? [],
  }));
  const firstTrade = report.trades[0];
  const finalPosition = report.portfolio.positions[symbol]?.at(-1)?.value ?? 0;
  const finalCash = report.portfolio.cash.at(-1)?.value ?? 0;
  const lastClose = market.at(-1)?.close ?? 0;

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference) and (min-width: 721px)", () => {
        gsap.timeline()
          .fromTo(`.${styles.heroLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.55, ease: "power2.out" })
          .fromTo(`.${styles.heroReadout}`, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, "-=0.3");

        gsap.timeline({
          scrollTrigger: { trigger: `.${styles.strategy}`, start: "top 66%", end: "center 48%", scrub: 0.45 },
        })
          .fromTo(`.${styles.strategyPrice}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.indicatorLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.08 }, "<18%")
          .fromTo(`.${styles.signalOutput}`, { scale: 0.86, opacity: 0 }, { scale: 1, opacity: 1 }, "<55%");

        gsap.timeline({
          scrollTrigger: { trigger: `.${styles.execution}`, start: "top 68%", end: "center 44%", scrub: 0.4 },
        })
          .fromTo(`.${styles.executionProgress}`, { scaleX: 0 }, { scaleX: 1, ease: "none" })
          .fromTo(`.${styles.executionStep}`, { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08 }, "<20%");

        gsap.timeline({
          scrollTrigger: { trigger: `.${styles.analytics}`, start: "top 62%", end: "center 42%", scrub: 0.4 },
        })
          .fromTo(`.${styles.benchmarkLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.equityLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, "<12%")
          .fromTo(`.${styles.drawdownArea}`, { opacity: 0 }, { opacity: 1 }, "<45%")
          .fromTo(`.${styles.metricStrip} > div`, { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04 }, "<55%");
      });
    }, root);
    return () => {
      context.revert();
      media.revert();
    };
  }, []);

  return (
    <main id="main-content" ref={root} className={styles.main} data-route="home">
      <div className={styles.continuousLine} aria-hidden="true"><i /><span>DATA</span><span>SIGNAL</span><span>ORDER</span><span>RISK</span></div>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroMeta}>
          <span>SamQuant / transparent research system</span>
          <span>{symbol} / daily / {market.length} bars</span>
        </div>
        <svg className={styles.heroChart} viewBox="0 0 1200 480" preserveAspectRatio="none" role="img" aria-label="Deterministic SamQuant demonstration price series">
          <path className={styles.heroLineGhost} d={pricePath} />
          <path className={styles.heroLine} pathLength="1" d={pricePath} />
        </svg>
        <div className={styles.heroReadout}>
          <span>Last close</span><strong>{formatNumber(lastClose)}</strong><small>Synthetic demo</small>
        </div>
        <div className={styles.heroContent}>
          <p className="eyebrow">Historical simulation with visible assumptions</p>
          <h1 id="hero-title">Test the strategy.<br />Not your luck.</h1>
          <p className={styles.heroCopy}>Follow one market line from raw prices to measured risk.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/research">Open research terminal <ArrowRight aria-hidden="true" size={16} /></Link>
            <Link href="/methodology">Read methodology</Link>
          </div>
        </div>
        <div className={styles.heroFoot}>
          <span><b>01</b> Data</span><span><b>02</b> Strategy</span><span><b>03</b> Execution</span><span><b>04</b> Risk</span>
        </div>
      </section>

      <section className={`${styles.band} ${styles.data}`} aria-labelledby="data-title">
        <StageLabel state="DATA / VALIDATED" label="Market data" />
        <div className={styles.sectionLead}>
          <h2 id="data-title">Clean data before asking it questions.</h2>
          <p>Each daily bar passes the same checks before strategy code sees it.</p>
        </div>
        <div className={styles.dataAudit}>
          <div className={styles.auditHeader}>
            <div><span>Input</span><strong>{symbol}.daily.csv</strong></div>
            <div><span>Output</span><strong>{market.length} valid bars</strong></div>
            <div className={styles.auditStatus}><Check aria-hidden="true" size={14} /><strong>Passed</strong></div>
          </div>
          <div className={styles.dataRows} role="table" aria-label="Validated sample market bars">
            <div role="row" className={styles.dataLabels}>
              <span role="columnheader">Date</span><span role="columnheader">Open</span><span role="columnheader">High</span><span role="columnheader">Low</span><span role="columnheader">Close</span><span role="columnheader">Volume</span>
            </div>
            {market.slice(72, 77).map((bar) => (
              <div role="row" key={bar.time}>
                <span role="cell">{bar.time}</span><span role="cell">{formatNumber(bar.open)}</span><span role="cell">{formatNumber(bar.high)}</span><span role="cell">{formatNumber(bar.low)}</span><span role="cell">{formatNumber(bar.close)}</span><span role="cell">{formatNumber(bar.volume, 0)}</span>
              </div>
            ))}
          </div>
          <div className={styles.validationRail}>
            <span><b>OHLCV</b><strong>Present</strong></span>
            <span><b>Missing</b><strong>0</strong></span>
            <span><b>Duplicates</b><strong>0</strong></span>
            <span><b>Dates</b><strong>Ascending</strong></span>
            <span><b>Cache</b><strong>Deterministic</strong></span>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.darkBand} ${styles.strategy}`} aria-labelledby="strategy-title">
        <StageLabel state="DATA / INTERPRETED" label="Strategy" inverse />
        <div className={styles.strategyHeading}>
          <div><h2 id="strategy-title">Indicators analyze. Strategies decide.</h2></div>
          <p>{STRATEGY_COPY[strategy]}</p>
        </div>
        <div className={styles.strategyBody}>
          <div className={styles.strategyControls} aria-label="Strategy demonstration">
            {(Object.keys(STRATEGY_COPY) as StrategyId[]).map((id) => (
              <button key={id} type="button" data-active={strategy === id} aria-pressed={strategy === id} onClick={() => setStrategy(id)}>{STRATEGY_SHORT_LABEL[id]}</button>
            ))}
            <p>Output: target weights. No cash changes here.</p>
          </div>
          <div className={styles.strategyCanvas}>
            <div className={styles.chartMeta}><span>{symbol} / close</span><span>{report.metadata.start} to {report.metadata.end}</span></div>
            <svg viewBox="0 0 1200 480" preserveAspectRatio="none" role="img" aria-label={`${activeDemo.strategyLabel} indicators over the demonstration price series`}>
              <path className={styles.strategyGrid} d="M0 120H1200M0 240H1200M0 360H1200" />
              <path className={styles.strategyPrice} pathLength="1" d={buildPath(closes, 1200, 480, 24, priceRange)} />
              {activeIndicators.map((indicator, index) => <path key={indicator.name} className={`${styles.indicatorLine} ${index === 1 ? styles.indicatorSecondary : ""}`} pathLength="1" d={buildTimedPath(indicator.values, 1200, 480, 24, priceRange)} />)}
            </svg>
            <div className={styles.chartLegend}>
              <span><i className={styles.priceKey} />Price</span>
              {activeIndicators.map((indicator, index) => <span key={indicator.name}><i data-secondary={index === 1} />{humanizeKey(indicator.name)}</span>)}
            </div>
            <div className={styles.signalOutput}><span>Target changes</span><strong>{activeDemo.signals.length}</strong></div>
          </div>
        </div>
        <div className={styles.responsibilityLine}><span>Reads completed bars</span><span>Returns target weights</span><span>Never executes orders</span></div>
      </section>

      <section className={`${styles.band} ${styles.execution}`} aria-labelledby="execution-title">
        <StageLabel state="SIGNAL / QUEUED" label="Execution engine" />
        <div className={styles.sectionLead}>
          <h2 id="execution-title">The strategy decides.<br />The engine executes.</h2>
          <p>Every target waits for the next bar before it can become a trade.</p>
        </div>
        <div className={styles.executionFlow}>
          <div className={styles.executionTrack}><i className={styles.executionProgress} /></div>
          <ExecutionStep label="Signal" value={firstTrade ? `${firstTrade.side} ${firstTrade.symbol}` : "Hold cash"} />
          <ExecutionStep label="Validate" value="Cash and position" />
          <ExecutionStep label="Order" value={firstTrade ? `${formatNumber(firstTrade.quantity, 3)} shares` : "No order"} />
          <ExecutionStep label="Fill" value={firstTrade ? `Next open + ${formatMoney(firstTrade.fee)} fee` : "No fill"} />
          <ExecutionStep label="Portfolio" value="Ledger updated" />
        </div>
        <div className={styles.executionRecord}>
          <div className={styles.portfolioEquation}>
            <span><small>Cash</small><strong>{formatMoney(finalCash)}</strong></span><b>+</b>
            <span><small>{symbol} shares</small><strong>{formatNumber(finalPosition, 3)}</strong></span><b>=</b>
            <span><small>Final value</small><strong>{formatMoney(report.metrics.finalValue)}</strong></span>
          </div>
          <div className={styles.guardrails}>
            <span><ShieldCheck aria-hidden="true" size={16} />Reject unaffordable buys</span>
            <span><ShieldCheck aria-hidden="true" size={16} />Reject oversized sells</span>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.darkBand} ${styles.analytics}`} aria-labelledby="analytics-title">
        <StageLabel state="PORTFOLIO / MEASURED" label="Analytics" inverse />
        <div className={styles.analyticsLead}>
          <h2 id="analytics-title">Return without risk is half a result.</h2>
          <p>The portfolio record becomes equity, benchmark, and drawdown curves.</p>
        </div>
        <div className={styles.analyticsChart}>
          <div className={styles.analyticsReadout}><span>Final portfolio</span><strong>{formatMoney(report.metrics.finalValue)}</strong><small>{report.trades.length} trades</small></div>
          <svg viewBox="0 0 1200 500" preserveAspectRatio="none" role="img" aria-label="Portfolio equity, benchmark, and drawdown from the deterministic SamQuant run">
            <path className={styles.analyticsGrid} d="M0 100H1200M0 200H1200M0 300H1200M0 370H1200" />
            <path className={styles.benchmarkLine} pathLength="1" d={buildTimedPath(report.portfolio.benchmark, 1200, 300, 18)} />
            <path className={styles.equityLine} pathLength="1" d={buildTimedPath(report.portfolio.equity, 1200, 300, 18)} />
            <path className={styles.drawdownArea} d={buildAreaPath(report.portfolio.drawdown, 1200, 110, 382)} />
          </svg>
          <div className={styles.chartLegend}><span><i />Portfolio</span><span><i data-secondary="true" />Benchmark</span><span><i className={styles.lossKey} />Drawdown</span></div>
        </div>
        <div className={styles.metricStrip}>
          <Metric label="Total return" value={formatPercent(report.metrics.totalReturn)} />
          <Metric label="Annualized" value={formatPercent(report.metrics.annualizedReturn)} />
          <Metric label="Volatility" value={formatPercent(report.metrics.annualizedVolatility)} />
          <Metric label="Sharpe" value={formatNumber(report.metrics.sharpeRatio)} />
          <Metric label="Max drawdown" value={formatPercent(report.metrics.maximumDrawdown)} />
          <Metric label="Win rate" value={formatPercent(report.metrics.winRate)} />
        </div>
        <p className={styles.disclosure}>This deterministic result demonstrates the software. It does not claim profitability.</p>
      </section>

      <section className={`${styles.band} ${styles.productReveal}`} aria-labelledby="product-title">
        <StageLabel state="SYSTEM / INTERACTIVE" label="Research terminal" />
        <div className={styles.revealCopy}>
          <h2 id="product-title">Run the complete system.</h2>
          <p>Choose the market, dates, strategy, costs, and starting capital.</p>
          <Link className={styles.primaryAction} href="/research">Open research terminal <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className={styles.terminalReveal} aria-label="Research terminal preview using real demonstration output">
          <div className={styles.terminalTop}><span>RESEARCH / {symbol}</span><span>RUN COMPLETE</span></div>
          <svg viewBox="0 0 800 270" preserveAspectRatio="none" role="img" aria-label="Actual demonstration equity curve preview"><path d={buildTimedPath(report.portfolio.equity, 800, 270, 18)} /></svg>
          <div className={styles.terminalMetrics}>
            <span>Final value <b>{formatMoney(report.metrics.finalValue)}</b></span><span>Trades <b>{report.metrics.tradeCount}</b></span><span>Drawdown <b>{formatPercent(report.metrics.maximumDrawdown)}</b></span>
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.trust}`} aria-labelledby="trust-title">
        <StageLabel state="METHOD / EXPOSED" label="Trust record" />
        <div className={styles.trustLead}><h2 id="trust-title">The assumptions stay beside the result.</h2></div>
        <div className={styles.trustList}>
          <span><b>Signal timing</b> Close today, next open tomorrow</span>
          <span><b>Trading costs</b> Fees and adverse slippage</span>
          <span><b>Bias control</b> Delayed signals and causality tests</span>
          <span><b>Public data</b> Deterministic synthetic OHLCV</span>
          <span><b>Current version</b> SamQuant {report.metadata.version}</span>
          <Link href="/methodology">Inspect the method <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
        <p className={styles.fullDisclaimer}>SamQuant is an educational research tool. Backtested results are hypothetical, depend on historical data and stated assumptions, and do not represent actual trading or guarantee future results. Nothing presented constitutes investment advice.</p>
      </section>

      <section className={`${styles.band} ${styles.project}`} aria-labelledby="project-title">
        <StageLabel state="PROJECT / OPEN" label="Architecture" inverse />
        <div className={styles.projectLead}>
          <h2 id="project-title">Built to be inspected.</h2>
          <p>Python owns the financial logic. Interfaces render typed results.</p>
        </div>
        <div className={styles.architectureFlow} aria-label="SamQuant architecture flow">
          {["Market data", "Strategies", "Trading engine", "Analytics", "Interfaces"].map((layer) => <span key={layer}>{layer}<i aria-hidden="true">→</i></span>)}
        </div>
        <div className={styles.projectLinks}>
          <Link href="/architecture">Architecture</Link><Link href="/docs">Documentation</Link><Link href="/changelog">Changelog</Link>
          <a href="https://github.com/samanyuahuja/SamQuant"><Code2 aria-hidden="true" size={15} />GitHub repository</a>
        </div>
      </section>
    </main>
  );
}

function StageLabel({ state, label, inverse = false }: { state: string; label: string; inverse?: boolean }) {
  return <div className={styles.stageLabel} data-inverse={inverse}><span>{state}</span><strong>{label}</strong></div>;
}

function ExecutionStep({ label, value }: { label: string; value: string }) {
  return <div className={styles.executionStep}><small>{label}</small><strong>{value}</strong></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function buildPath(values: number[], width: number, height: number, padding: number, suppliedRange?: [number, number]): string {
  if (values.length < 2) return "";
  const [minimum, maximum] = suppliedRange ?? range(values);
  const spread = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - minimum) / spread) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function buildTimedPath(values: TimeValue[], width: number, height: number, padding: number, suppliedRange?: [number, number]): string {
  const finite = values.flatMap((point) => point.value === null ? [] : [point.value]);
  if (finite.length < 2) return "";
  const [minimum, maximum] = suppliedRange ?? range(finite);
  const spread = maximum - minimum || 1;
  let started = false;
  return values.map((point, index) => {
    if (point.value === null) return "";
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point.value - minimum) / spread) * (height - padding * 2);
    const command = started ? "L" : "M";
    started = true;
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}

function buildAreaPath(values: TimeValue[], width: number, height: number, offsetY: number): string {
  const finite = values.map((point) => point.value ?? 0);
  const minimum = Math.min(...finite, -0.01);
  const points = finite.map((value, index) => {
    const x = (index / (finite.length - 1)) * width;
    const y = offsetY + (value / minimum) * height;
    return `L${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return `M0,${offsetY} ${points} L${width},${offsetY} Z`;
}
