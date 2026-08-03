"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Code2, ShieldCheck } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { formatMoney, formatNumber, formatPercent, humanizeKey } from "@/lib/format";
import type {
  BacktestResponse,
  MetricValues,
  SignalRecord,
  StrategyId,
  TimeValue,
} from "@/lib/types";
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
  moving_average: "A fast average crossing a slower one changes the target weight.",
  mean_reversion: "A rolling z-score marks prices that sit unusually far below their recent mean.",
  momentum: "Trailing returns rank the assets before the portfolio selects its leaders.",
};

const SYSTEM_TRACE = "M76,0 C76,38 31,42 31,88 S77,132 77,176 S24,224 24,284 S74,334 74,395 S38,451 38,514 S79,567 79,632 S28,692 28,754 S73,817 73,875 S46,939 46,1000";

export function LandingStory({
  report,
  strategyDemos,
}: {
  report: BacktestResponse;
  strategyDemos: StrategyDemos;
}) {
  const root = useRef<HTMLElement>(null);
  const [strategy, setStrategy] = useState<StrategyId>("moving_average");
  const symbol = report.metadata.symbols[0];
  const market = report.market[symbol];
  const closes = market.map((bar) => bar.close);
  const activeDemo = strategyDemos[strategy];
  const pricePath = useMemo(() => buildPath(closes, 1200, 480, 20), [closes]);
  const priceRange = range(closes);
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
          .fromTo(`.${styles.heroLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.7, ease: "power2.out" })
          .fromTo(`.${styles.heroReadout}`, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.35");

        gsap.fromTo(
          `.${styles.traceActive}`,
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.25 },
          },
        );

        gsap.timeline({
          scrollTrigger: {
            trigger: `.${styles.strategyChapter}`,
            start: "top top",
            end: "+=1250",
            scrub: 0.55,
            pin: `.${styles.strategyStage}`,
          },
        })
          .fromTo(`.${styles.strategyPrice}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.indicatorLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.1 })
          .fromTo(`.${styles.signalMarker}`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 });

        gsap.fromTo(
          `.${styles.executionProgress}`,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: `.${styles.executionChapter}`,
              start: "top 68%",
              end: "bottom 42%",
              scrub: true,
            },
          },
        );

        gsap.timeline({
          scrollTrigger: {
            trigger: `.${styles.analyticsChapter}`,
            start: "top 62%",
            end: "bottom 48%",
            scrub: 0.45,
          },
        })
          .fromTo(`.${styles.benchmarkLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.equityLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, "<20%")
          .fromTo(`.${styles.drawdownArea}`, { opacity: 0 }, { opacity: 1 }, "<35%");
      });
    }, root);
    return () => {
      context.revert();
      media.revert();
    };
  }, []);

  return (
    <main id="main-content" ref={root} className={styles.main}>
      <div className={styles.systemTrace} aria-hidden="true">
        <svg viewBox="0 0 100 1000" preserveAspectRatio="none">
          <path className={styles.traceGhost} d={SYSTEM_TRACE} />
          <path className={styles.traceActive} pathLength="1" d={SYSTEM_TRACE} />
        </svg>
      </div>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroMeta}>
          <span>SamQuant / research system</span>
          <span>{symbol} · daily · {market.length} bars</span>
        </div>
        <svg className={styles.heroChart} viewBox="0 0 1200 480" preserveAspectRatio="none" role="img" aria-label="A deterministic SamQuant demonstration price series">
          <path className={styles.heroLineGhost} d={pricePath} />
          <path className={styles.heroLine} pathLength="1" d={pricePath} />
        </svg>
        <div className={styles.heroReadout} aria-hidden="true">
          <span>Last close</span>
          <strong>{formatNumber(lastClose)}</strong>
          <small>synthetic demo</small>
        </div>
        <div className={styles.heroContent}>
          <p className="eyebrow">Historical simulation, without hidden steps</p>
          <h1 id="hero-title">Test the strategy.<br />Not your luck.</h1>
          <p className={styles.heroCopy}>SamQuant keeps the data, signal, order, portfolio, and risk record in one inspectable run.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/research">
              Open research terminal <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link href="/methodology">Methodology</Link>
            <a href="https://github.com/samanyuahuja/SamQuant">Source code</a>
          </div>
        </div>
        <div className={styles.heroFoot}>
          <span>One price line</span>
          <span>Five accountable layers</span>
          <span>Scroll to follow the run ↓</span>
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.paperChapter} ${styles.dataChapter}`} aria-labelledby="data-title">
        <ChapterLabel number="01" label="Market data" detail="Input before opinion" />
        <div className={styles.chapterLead}>
          <p className={styles.kicker}>RAW BARS / VALIDATION GATE</p>
          <h2 id="data-title">First, make the data boring.</h2>
          <p>Dates are sorted, duplicates are removed, required prices are checked, and only then can a strategy read the series.</p>
        </div>
        <div className={styles.dataAudit}>
          <div className={styles.auditHeader}>
            <div><span>INPUT</span><strong>{symbol}.daily.csv</strong></div>
            <div><span>OUTPUT</span><strong>{market.length} validated bars</strong></div>
            <div className={styles.auditStatus}><Check aria-hidden="true" size={14} /><strong>Passed</strong></div>
          </div>
          <div className={styles.dataRows} role="table" aria-label="Validated sample market bars">
            <div role="row" className={styles.dataLabels}>
              <span role="columnheader">Date</span><span role="columnheader">Open</span><span role="columnheader">High</span><span role="columnheader">Low</span><span role="columnheader">Close</span><span role="columnheader">Volume</span>
            </div>
            {market.slice(72, 77).map((bar) => (
              <div role="row" key={bar.time}>
                <span role="cell">{bar.time}</span>
                <span role="cell">{formatNumber(bar.open)}</span>
                <span role="cell">{formatNumber(bar.high)}</span>
                <span role="cell">{formatNumber(bar.low)}</span>
                <span role="cell">{formatNumber(bar.close)}</span>
                <span role="cell">{formatNumber(bar.volume, 0)}</span>
              </div>
            ))}
          </div>
          <div className={styles.validationRail}>
            <span><b>01</b> OHLC present <strong>Yes</strong></span>
            <span><b>02</b> Missing values <strong>0</strong></span>
            <span><b>03</b> Duplicate dates <strong>0</strong></span>
            <span><b>04</b> Chronology <strong>Ascending</strong></span>
          </div>
        </div>
      </section>

      <section className={styles.strategyChapter} aria-labelledby="strategy-title">
        <div className={styles.strategyStage}>
          <ChapterLabel number="02" label="Strategy" detail="Decision, not execution" />
          <div className={styles.strategyHeading}>
            <div>
              <p className={styles.kicker}>TARGET WEIGHT / {activeDemo.strategyLabel.toUpperCase()}</p>
              <h2 id="strategy-title">The decision layer.</h2>
            </div>
            <p>{STRATEGY_COPY[strategy]}</p>
          </div>
          <div className={styles.strategyBody}>
            <div className={styles.strategyControls} aria-label="Strategy demonstration">
              {(Object.keys(STRATEGY_COPY) as StrategyId[]).map((id, index) => (
                <button key={id} type="button" data-active={strategy === id} onClick={() => setStrategy(id)}>
                  <span>0{index + 1}</span>
                  {strategyDemos[id].strategyLabel.replace(" crossover", "")}
                </button>
              ))}
              <p>Strategies return target weights. They never alter cash or positions directly.</p>
            </div>
            <div className={styles.strategyCanvas}>
              <div className={styles.chartMeta}><span>{symbol} / close</span><span>{report.metadata.start} → {report.metadata.end}</span></div>
              <svg viewBox="0 0 1200 480" preserveAspectRatio="none" role="img" aria-label={`${activeDemo.strategyLabel} indicators over the demonstration price series`}>
                <path className={styles.strategyPrice} pathLength="1" d={buildPath(closes, 1200, 480, 24, priceRange)} />
                {activeIndicators.map((indicator, index) => (
                  <path
                    key={indicator.name}
                    className={`${styles.indicatorLine} ${index === 1 ? styles.indicatorSecondary : ""}`}
                    pathLength="1"
                    d={buildTimedPath(indicator.values, 1200, 480, 24, priceRange)}
                  />
                ))}
              </svg>
              <div className={styles.chartLegend}>
                <span><i className={styles.priceKey} /> Price</span>
                {activeIndicators.map((indicator, index) => (
                  <span key={indicator.name}><i data-secondary={index === 1} />{humanizeKey(indicator.name)}</span>
                ))}
              </div>
              <div className={styles.signalMarker}>
                <span>OUTPUT</span>
                <strong>{activeDemo.signals.length}</strong>
                <small>target changes</small>
              </div>
            </div>
          </div>
          <div className={styles.strategyRule}>
            <span>Reads</span><b>Bars through today&apos;s close</b>
            <span>Returns</span><b>Target portfolio weights</b>
            <span>Cannot touch</span><b>Cash, fills, or metrics</b>
          </div>
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.paperChapter} ${styles.executionChapter}`} aria-labelledby="execution-title">
        <ChapterLabel number="03" label="Execution engine" detail="Signal becomes state" />
        <div className={styles.chapterLead}>
          <p className={styles.kicker}>NEXT BAR / OPEN PRICE</p>
          <h2 id="execution-title">The strategy decides.<br />The engine executes.</h2>
          <p>A target waits until the following bar, passes portfolio checks, pays its modeled costs, and becomes an immutable trade record.</p>
        </div>
        <div className={styles.orderTape}>
          <div className={styles.executionTrack}><i className={styles.executionProgress} /></div>
          <ExecutionStep number="01" label="Signal" value={firstTrade ? `${firstTrade.side} ${firstTrade.symbol}` : "Hold cash"} />
          <ExecutionStep number="02" label="Validate" value="Cash + position" />
          <ExecutionStep number="03" label="Fill" value={firstTrade ? `${formatNumber(firstTrade.quantity, 3)} @ ${formatMoney(firstTrade.price)}` : "No order"} />
          <ExecutionStep number="04" label="Record" value={firstTrade ? `${formatMoney(firstTrade.fee)} fee` : "No fee"} />
        </div>
        <div className={styles.executionRecord}>
          <div className={styles.portfolioEquation}>
            <span><small>Cash</small><strong>{formatMoney(finalCash)}</strong></span>
            <b>+</b>
            <span><small>{symbol} position</small><strong>{formatNumber(finalPosition, 3)} shares</strong></span>
            <b>=</b>
            <span><small>Portfolio value</small><strong>{formatMoney(report.metrics.finalValue)}</strong></span>
          </div>
          <div className={styles.guardrails}>
            <div><ShieldCheck aria-hidden="true" size={16} /><span>Insufficient cash</span><strong>Reject before fill</strong></div>
            <div><ShieldCheck aria-hidden="true" size={16} /><span>Sell above position</span><strong>Reject before fill</strong></div>
          </div>
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.analyticsChapter}`} aria-labelledby="analytics-title">
        <ChapterLabel number="04" label="Portfolio + analytics" detail="Outcome with context" />
        <div className={styles.analyticsLead}>
          <p className={styles.kicker}>EQUITY / BENCHMARK / DRAWDOWN</p>
          <h2 id="analytics-title">Return without risk is only half the result.</h2>
          <p>Every fill changes cash and positions. That ledger becomes the equity curve, the benchmark comparison, and the drawdown record.</p>
        </div>
        <div className={styles.analyticsGrid}>
          <div className={styles.analyticsHeadline}>
            <span>Final portfolio</span>
            <strong>{formatMoney(report.metrics.finalValue)}</strong>
            <small>{report.trades.length} executed trades</small>
          </div>
          <div className={styles.analyticsChart}>
            <div className={styles.chartMeta}><span>Strategy</span><span>Equal-weight benchmark</span></div>
            <svg viewBox="0 0 1200 500" preserveAspectRatio="none" role="img" aria-label="Portfolio equity, benchmark, and drawdown from the deterministic SamQuant run">
              <path className={styles.benchmarkLine} pathLength="1" d={buildTimedPath(report.portfolio.benchmark, 1200, 315, 20)} />
              <path className={styles.equityLine} pathLength="1" d={buildTimedPath(report.portfolio.equity, 1200, 315, 20)} />
              <path className={styles.drawdownArea} d={buildAreaPath(report.portfolio.drawdown, 1200, 130, 355)} />
            </svg>
          </div>
        </div>
        <div className={styles.metricStrip}>
          <Metric label="Total return" value={formatPercent(report.metrics.totalReturn)} />
          <Metric label="Annualized" value={formatPercent(report.metrics.annualizedReturn)} />
          <Metric label="Volatility" value={formatPercent(report.metrics.annualizedVolatility)} />
          <Metric label="Sharpe" value={formatNumber(report.metrics.sharpeRatio)} />
          <Metric label="Max drawdown" value={formatPercent(report.metrics.maximumDrawdown)} />
          <Metric label="Win rate" value={formatPercent(report.metrics.winRate)} />
        </div>
        <p className={styles.disclosure}>Hypothetical research result. Real fees, liquidity, slippage, taxes, and fills may differ.</p>
      </section>

      <section className={`${styles.chapter} ${styles.paperChapter} ${styles.productReveal}`} aria-labelledby="product-title">
        <ChapterLabel number="05" label="Research terminal" detail="The complete run" />
        <div className={styles.revealCopy}>
          <p className={styles.kicker}>REAL INTERFACE / REAL ENGINE OUTPUT</p>
          <h2 id="product-title">Now run the system yourself.</h2>
          <p>Change the market, dates, strategy, capital, fees, and slippage. The Python engine recalculates the complete record.</p>
          <Link className={styles.primaryAction} href="/research">Open the research terminal <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <div className={styles.terminalReveal} aria-label="A terminal excerpt made from the real demonstration result">
          <div className={styles.terminalTop}><span>RESEARCH / {symbol}</span><span>RUN COMPLETE</span></div>
          <svg viewBox="0 0 800 270" preserveAspectRatio="none" role="img" aria-label="Actual demonstration equity curve preview">
            <path d={buildTimedPath(report.portfolio.equity, 800, 270, 18)} />
          </svg>
          <div className={styles.terminalMetrics}>
            <span>Final value <b>{formatMoney(report.metrics.finalValue)}</b></span>
            <span>Trades <b>{report.metrics.tradeCount}</b></span>
            <span>Drawdown <b>{formatPercent(report.metrics.maximumDrawdown)}</b></span>
          </div>
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.trustChapter}`} aria-labelledby="trust-title">
        <ChapterLabel number="06" label="Methodology" detail="What the result assumes" />
        <div className={styles.trustLead}>
          <p className={styles.kicker}>NO HIDDEN FOOTNOTES</p>
          <h2 id="trust-title">The assumptions stay beside the result.</h2>
        </div>
        <div className={styles.trustList}>
          <span><b>Signal timing</b> Today&apos;s close, next bar&apos;s open</span>
          <span><b>Trading costs</b> Commission, fixed fees, adverse slippage</span>
          <span><b>Bias control</b> One-bar delay and causality tests</span>
          <span><b>Public data</b> Deterministic synthetic OHLCV</span>
          <span><b>Current version</b> SamQuant {report.metadata.version}</span>
          <Link href="/methodology">Inspect every assumption <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.projectChapter}`} aria-labelledby="project-title">
        <ChapterLabel number="07" label="Open project" detail="Python remains authoritative" />
        <div className={styles.projectLead}>
          <p className={styles.kicker}>SOURCE / TESTS / DOCUMENTATION</p>
          <h2 id="project-title">Built to be inspected.</h2>
          <p>The interface renders typed results. Market logic, orders, portfolio accounting, and metrics stay in the Python package.</p>
        </div>
        <div className={styles.architectureFlow} aria-label="SamQuant architecture flow">
          {["Market data", "Strategy", "Execution", "Portfolio", "Analytics", "Interfaces"].map((layer, index) => (
            <span key={layer}><b>{String(index + 1).padStart(2, "0")}</b>{layer}<i aria-hidden="true">→</i></span>
          ))}
        </div>
        <div className={styles.projectLinks}>
          <Link href="/architecture">Architecture</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/changelog">Changelog</Link>
          <a href="https://github.com/samanyuahuja/SamQuant"><Code2 aria-hidden="true" size={15} /> GitHub repository</a>
        </div>
      </section>
    </main>
  );
}

function ChapterLabel({ number, label, detail }: { number: string; label: string; detail: string }) {
  return <div className={styles.chapterLabel}><span>{number}</span><strong>{label}</strong><small>{detail}</small></div>;
}

function ExecutionStep({ number, label, value }: { number: string; label: string; value: string }) {
  return <div className={styles.executionStep}><span>{number}</span><small>{label}</small><strong>{value}</strong></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function buildPath(
  values: number[],
  width: number,
  height: number,
  padding: number,
  suppliedRange?: [number, number],
): string {
  if (values.length < 2) return "";
  const [minimum, maximum] = suppliedRange ?? range(values);
  const spread = maximum - minimum || 1;
  return values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - minimum) / spread) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function buildTimedPath(
  values: TimeValue[],
  width: number,
  height: number,
  padding: number,
  suppliedRange?: [number, number],
): string {
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
