"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Database,
  Gauge,
  Code2,
  ShieldCheck,
} from "lucide-react";
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
  moving_average: "Compares a fast trend with a slower trend.",
  mean_reversion: "Looks for unusually low prices that may recover.",
  momentum: "Ranks recent returns and holds the strongest assets.",
};

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

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add("(prefers-reduced-motion: no-preference) and (min-width: 721px)", () => {
        gsap.fromTo(
          `.${styles.heroLine}`,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 1.8, ease: "power2.out" },
        );

        gsap.timeline({
          scrollTrigger: {
            trigger: `.${styles.strategyChapter}`,
            start: "top top",
            end: "+=1200",
            scrub: 0.6,
            pin: `.${styles.strategyStage}`,
          },
        })
          .fromTo(`.${styles.strategyPrice}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.indicatorLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, stagger: 0.1 })
          .fromTo(`.${styles.signalPulse}`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 });

        gsap.fromTo(
          `.${styles.executionProgress}`,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: `.${styles.executionChapter}`,
              start: "top 70%",
              end: "bottom 45%",
              scrub: true,
            },
          },
        );

        gsap.timeline({
          scrollTrigger: {
            trigger: `.${styles.analyticsChapter}`,
            start: "top 65%",
            end: "bottom 55%",
            scrub: 0.5,
          },
        })
          .fromTo(`.${styles.equityLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 })
          .fromTo(`.${styles.drawdownArea}`, { opacity: 0 }, { opacity: 1 }, "<30%");
      });
    }, root);
    return () => {
      context.revert();
      media.revert();
    };
  }, []);

  return (
    <main id="main-content" ref={root} className={styles.main}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <svg className={styles.heroChart} viewBox="0 0 1200 480" preserveAspectRatio="none" role="img" aria-label="A deterministic SamQuant demonstration price series">
          <path className={styles.heroLineGhost} d={pricePath} />
          <path className={styles.heroLine} pathLength="1" d={pricePath} />
        </svg>
        <div className={styles.heroContent}>
          <p className="eyebrow">SamQuant research system</p>
          <h1 id="hero-title">Test the strategy.<br />Not your luck.</h1>
          <p className={styles.heroCopy}>A transparent backtesting system for signals, execution, portfolio accounting, and risk.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/research">
              Open research terminal <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link href="/methodology">Read methodology</Link>
            <a href="https://github.com/samanyuahuja/SamQuant">GitHub</a>
          </div>
        </div>
        <div className={styles.heroFoot}>
          <span>Deterministic demo</span>
          <span>{report.metadata.start} / {report.metadata.end}</span>
          <span>Scroll to trace the system</span>
        </div>
      </section>

      <section className={styles.dataChapter} aria-labelledby="data-title">
        <div className={styles.chapterIntro}>
          <p className="eyebrow">01 / Market data</p>
          <h2 id="data-title">A strategy is only as clean as its input.</h2>
          <p>SamQuant normalizes OHLCV bars before any strategy sees them.</p>
        </div>
        <div className={styles.dataWorkbench}>
          <div className={styles.dataHeader}>
            <span>{symbol} / daily bars</span>
            <span>{market.length} validated rows</span>
          </div>
          <div className={styles.dataRows} role="table" aria-label="Validated sample market bars">
            <div role="row" className={styles.dataLabels}>
              <span role="columnheader">Date</span><span role="columnheader">Open</span><span role="columnheader">High</span><span role="columnheader">Low</span><span role="columnheader">Close</span><span role="columnheader">Status</span>
            </div>
            {market.slice(72, 77).map((bar) => (
              <div role="row" key={bar.time}>
                <span role="cell">{bar.time}</span>
                <span role="cell">{formatNumber(bar.open)}</span>
                <span role="cell">{formatNumber(bar.high)}</span>
                <span role="cell">{formatNumber(bar.low)}</span>
                <span role="cell">{formatNumber(bar.close)}</span>
                <span role="cell" className={styles.valid}><Check aria-hidden="true" size={13} /> Valid</span>
              </div>
            ))}
          </div>
          <div className={styles.validationRail}>
            <span>Required fields <b>5 / 5</b></span>
            <span>Missing values <b>0</b></span>
            <span>Duplicates <b>0</b></span>
            <span>Sort order <b>Passed</b></span>
          </div>
        </div>
      </section>

      <section className={styles.strategyChapter} aria-labelledby="strategy-title">
        <div className={styles.strategyStage}>
          <div className={styles.chapterIntro}>
            <p className="eyebrow">02 / Strategy</p>
            <h2 id="strategy-title">The decision layer.</h2>
            <p>{STRATEGY_COPY[strategy]}</p>
          </div>
          <div className={styles.strategyControls} aria-label="Strategy demonstration">
            {(Object.keys(STRATEGY_COPY) as StrategyId[]).map((id) => (
              <button key={id} type="button" data-active={strategy === id} onClick={() => setStrategy(id)}>
                {strategyDemos[id].strategyLabel.replace(" crossover", "")}
              </button>
            ))}
          </div>
          <div className={styles.strategyCanvas}>
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
            <div className={styles.signalPulse}>
              <strong>{activeDemo.signals.length}</strong>
              <span>target changes</span>
            </div>
          </div>
          <div className={styles.strategyRule}>
            <span>Inputs</span><b>Historical bars through close</b>
            <span>Output</span><b>Target portfolio weights</b>
            <span>Execution</span><b>Not handled here</b>
          </div>
        </div>
      </section>

      <section className={styles.executionChapter} aria-labelledby="execution-title">
        <div className={styles.chapterIntro}>
          <p className="eyebrow">03 / Execution engine</p>
          <h2 id="execution-title">The strategy decides.<br />The engine executes.</h2>
          <p>A target becomes an order on the following market bar.</p>
        </div>
        <div className={styles.executionFlow}>
          <div className={styles.executionTrack}><i className={styles.executionProgress} /></div>
          <ExecutionStep icon={<Gauge />} label="Signal" value={firstTrade ? `${firstTrade.side} ${firstTrade.symbol}` : "Hold cash"} />
          <ExecutionStep icon={<ShieldCheck />} label="Validate" value="Cash and position checks" />
          <ExecutionStep icon={<CircleDollarSign />} label="Fill" value={firstTrade ? `${formatNumber(firstTrade.quantity, 3)} at ${formatMoney(firstTrade.price)}` : "No order"} />
          <ExecutionStep icon={<Database />} label="Record" value={firstTrade ? `${formatMoney(firstTrade.fee)} fee` : "No fee"} />
        </div>
        <div className={styles.ledger}>
          <div><span>Starting cash</span><strong>{formatMoney(report.portfolio.cash[0]?.value ?? report.metrics.finalValue)}</strong></div>
          <div><span>Executed trades</span><strong>{report.trades.length}</strong></div>
          <div><span>Final position</span><strong>{formatNumber(finalPosition, 3)} {symbol}</strong></div>
          <div><span>Final value</span><strong>{formatMoney(report.metrics.finalValue)}</strong></div>
        </div>
      </section>

      <section className={styles.analyticsChapter} aria-labelledby="analytics-title">
        <div className={styles.chapterIntro}>
          <p className="eyebrow">04 / Analytics</p>
          <h2 id="analytics-title">Return without risk is only half the result.</h2>
          <p>The same portfolio history becomes an equity curve and drawdown record.</p>
        </div>
        <div className={styles.analyticsChart}>
          <svg viewBox="0 0 1200 460" preserveAspectRatio="none" role="img" aria-label="Portfolio equity and drawdown from the deterministic SamQuant run">
            <path className={styles.equityGhost} d={buildTimedPath(report.portfolio.equity, 1200, 300, 20)} />
            <path className={styles.equityLine} pathLength="1" d={buildTimedPath(report.portfolio.equity, 1200, 300, 20)} />
            <path className={styles.drawdownArea} d={buildAreaPath(report.portfolio.drawdown, 1200, 120, 330)} />
          </svg>
          <div className={styles.metricStrip}>
            <Metric label="Total return" value={formatPercent(report.metrics.totalReturn)} />
            <Metric label="Annualized" value={formatPercent(report.metrics.annualizedReturn)} />
            <Metric label="Volatility" value={formatPercent(report.metrics.annualizedVolatility)} />
            <Metric label="Sharpe" value={formatNumber(report.metrics.sharpeRatio)} />
            <Metric label="Max drawdown" value={formatPercent(report.metrics.maximumDrawdown)} />
            <Metric label="Win rate" value={formatPercent(report.metrics.winRate)} />
          </div>
        </div>
        <p className={styles.disclosure}>Hypothetical demonstration only. Real trading costs and fills may differ.</p>
      </section>

      <section className={styles.productReveal} aria-labelledby="product-title">
        <div className={styles.revealCopy}>
          <p className="eyebrow">05 / Research terminal</p>
          <h2 id="product-title">Now run the system yourself.</h2>
          <p>Change the market, symbols, strategy, dates, cash, and execution costs.</p>
          <Link className={styles.primaryAction} href="/research">Open the research terminal <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        <div className={styles.terminalReveal} aria-label="A preview made from the real demonstration result">
          <div className={styles.terminalTop}><span>Performance / {symbol}</span><span>Run complete</span></div>
          <svg viewBox="0 0 800 270" preserveAspectRatio="none" role="img" aria-label="Demonstration equity curve preview">
            <path d={buildTimedPath(report.portfolio.equity, 800, 270, 18)} />
          </svg>
          <div className={styles.terminalMetrics}>
            <span>Final value <b>{formatMoney(report.metrics.finalValue)}</b></span>
            <span>Trades <b>{report.metrics.tradeCount}</b></span>
            <span>Drawdown <b>{formatPercent(report.metrics.maximumDrawdown)}</b></span>
          </div>
        </div>
      </section>

      <section className={styles.trustChapter} aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Methodology and trust</p>
          <h2 id="trust-title">The assumptions stay visible.</h2>
        </div>
        <div className={styles.trustList}>
          <span><b>Timing</b> Next-open execution</span>
          <span><b>Costs</b> Fees and adverse slippage</span>
          <span><b>Bias control</b> Causality tests</span>
          <span><b>Data</b> Deterministic public demo</span>
          <span><b>Version</b> SamQuant {report.metadata.version}</span>
          <Link href="/methodology">Read every assumption <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
      </section>

      <section className={styles.projectChapter} aria-labelledby="project-title">
        <div>
          <p className="eyebrow">Open project</p>
          <h2 id="project-title">Built to be inspected.</h2>
        </div>
        <div className={styles.architectureFlow} aria-label="SamQuant architecture flow">
          {[
            "Market data",
            "Strategies",
            "Execution",
            "Portfolio",
            "Analytics",
            "Interfaces",
          ].map((layer, index) => (
            <span key={layer}><b>{String(index + 1).padStart(2, "0")}</b>{layer}</span>
          ))}
        </div>
        <div className={styles.projectLinks}>
          <Link href="/architecture">Architecture</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/changelog">Changelog</Link>
          <a href="https://github.com/samanyuahuja/SamQuant"><Code2 aria-hidden="true" size={16} /> GitHub repository</a>
        </div>
      </section>
    </main>
  );
}

function ExecutionStep({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className={styles.executionStep}><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>;
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
