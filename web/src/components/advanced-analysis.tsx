import type { CSSProperties } from "react";

import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { BacktestResponse } from "@/lib/types";
import styles from "./advanced-analysis.module.css";

export function PortfolioLab({ report }: { report: BacktestResponse }) {
  const analysis = report.portfolioAnalysis;
  if (!analysis) return <MissingAnalysis />;
  const symbols = report.metadata.symbols;

  return (
    <div className={styles.analysisPanel}>
      <header className={styles.analysisHeader}>
        <div><span>Historical allocation research</span><h3>Portfolio lab</h3></div>
        <p>Approximate long-only frontier.</p>
      </header>

      <section className={styles.optimizationSummary} aria-label="Maximum Sharpe portfolio">
        <Metric label="Expected return" value={formatPercent(analysis.maxSharpe.expectedReturn)} />
        <Metric label="Volatility" value={formatPercent(analysis.maxSharpe.volatility)} />
        <Metric label="Sharpe" value={formatNumber(analysis.maxSharpe.sharpeRatio)} />
        <Metric label="Diversification" value={formatNumber(analysis.maxSharpe.diversificationRatio)} />
      </section>

      <div className={styles.portfolioGrid}>
        <section className={styles.weights} aria-labelledby="weights-heading">
          <h4 id="weights-heading">Maximum-Sharpe weights</h4>
          {symbols.map((symbol) => {
            const weight = analysis.maxSharpe.weights[symbol] ?? 0;
            return <div key={symbol}>
              <span>{symbol}</span>
              <i style={{ "--weight": `${Math.max(0, weight ?? 0) * 100}%` } as CSSProperties} />
              <strong>{formatPercent(weight)}</strong>
            </div>;
          })}
        </section>
        <FrontierChart report={report} />
      </div>

      <section className={styles.matrixSection} aria-labelledby="correlation-heading">
        <div><h4 id="correlation-heading">Correlation matrix</h4><span>1 means assets moved together.</span></div>
        <div className={styles.matrixWrap}>
          <table>
            <caption>Historical return correlations</caption>
            <thead><tr><th>Asset</th>{symbols.map((symbol) => <th key={symbol}>{symbol}</th>)}</tr></thead>
            <tbody>{symbols.map((row) => <tr key={row}><th>{row}</th>{symbols.map((column) => {
              const value = analysis.correlation[row]?.[column] ?? null;
              return <td key={column} data-band={correlationBand(value)}>{formatNumber(value)}</td>;
            })}</tr>)}</tbody>
          </table>
        </div>
      </section>
      <p className={styles.analysisNote}>Historical estimates can change. They are not allocation advice.</p>
    </div>
  );
}

export function MonteCarloLab({ report, currency }: { report: BacktestResponse; currency: string }) {
  const simulation = report.monteCarlo;
  if (!simulation) return <MissingAnalysis />;
  const histogram = histogramBins(simulation.endingValues);

  return (
    <div className={styles.analysisPanel}>
      <header className={styles.analysisHeader}>
        <div><span>Equal-weight hypothetical simulation</span><h3>Monte Carlo</h3></div>
        <p>Possible paths, not price predictions.</p>
      </header>
      <section className={styles.simulationSummary} aria-label="Monte Carlo summary">
        <Metric label="Median ending" value={formatNullableMoney(simulation.medianEndingValue, currency)} />
        <Metric label="Mean ending" value={formatNullableMoney(simulation.meanEndingValue, currency)} />
        <Metric label="Below start" value={formatPercent(simulation.probabilityBelowStart)} />
        <Metric label="5th percentile" value={formatNullableMoney(simulation.percentile5, currency)} />
        <Metric label="95th percentile" value={formatNullableMoney(simulation.percentile95, currency)} />
      </section>
      <div className={styles.simulationGrid}>
        <SimulationPaths report={report} />
        <DistributionChart bins={histogram} currency={currency} />
      </div>
      <p className={styles.analysisNote}>Historical averages and correlations drive every simulated path.</p>
    </div>
  );
}

function FrontierChart({ report }: { report: BacktestResponse }) {
  const analysis = report.portfolioAnalysis!;
  const points = analysis.frontier.flatMap((point) =>
    point.volatility === null || point.expectedReturn === null ? [] : [point],
  );
  const xValues = points.map((point) => point.volatility as number);
  const yValues = points.map((point) => point.expectedReturn as number);
  const xRange = extent(xValues);
  const yRange = extent(yValues);
  return <figure className={styles.chartFigure}>
    <figcaption><strong>Efficient frontier</strong><span>Risk compared with return.</span></figcaption>
    <svg viewBox="0 0 700 330" role="img" aria-label="Approximate efficient frontier using historical asset returns">
      <path className={styles.gridLines} d="M54 28V286H676M54 92H676M54 157H676M54 221H676M209 28V286M365 28V286M520 28V286" />
      {points.map((point, index) => <circle key={`${point.volatility}-${point.expectedReturn}`} className={styles.frontierPoint} cx={scale(point.volatility!, xRange, 54, 676)} cy={scale(point.expectedReturn!, yRange, 286, 28)} r={index === points.length - 1 ? 4 : 2.5} />)}
      <circle className={styles.winnerPoint} cx={scale(analysis.maxSharpe.volatility ?? 0, xRange, 54, 676)} cy={scale(analysis.maxSharpe.expectedReturn ?? 0, yRange, 286, 28)} r="6" />
      <text x="54" y="315">Lower volatility</text><text x="580" y="315">Higher volatility</text>
    </svg>
  </figure>;
}

function SimulationPaths({ report }: { report: BacktestResponse }) {
  const simulation = report.monteCarlo!;
  const values = simulation.displayPaths.flatMap((path) => path.filter((value): value is number => value !== null));
  const range = extent(values);
  return <figure className={styles.chartFigure}>
    <figcaption><strong>Simulated paths</strong><span>{simulation.displayPaths.length} paths shown.</span></figcaption>
    <svg viewBox="0 0 700 330" role="img" aria-label="Hypothetical Monte Carlo portfolio paths">
      <path className={styles.gridLines} d="M54 28V286H676M54 92H676M54 157H676M54 221H676" />
      {simulation.displayPaths.map((path, index) => <path key={index} pathLength="1" className={styles.simulationPath} d={linePath(path, range, 54, 676, 28, 286)} />)}
      <text x="54" y="315">Day 0</text><text x="610" y="315">Day {simulation.days.at(-1)}</text>
    </svg>
  </figure>;
}

function DistributionChart({ bins, currency }: { bins: Array<{ start: number; end: number; count: number }>; currency: string }) {
  const maximum = Math.max(...bins.map((bin) => bin.count), 1);
  return <figure className={styles.chartFigure}>
    <figcaption><strong>Ending-value distribution</strong><span>Frequency across simulations.</span></figcaption>
    <div className={styles.histogram} role="img" aria-label="Distribution of simulated ending portfolio values">
      {bins.map((bin) => <i key={bin.start} style={{ "--height": `${bin.count / maximum * 100}%` } as CSSProperties} title={`${formatMoney(bin.start, currency)} to ${formatMoney(bin.end, currency)}: ${bin.count}`} />)}
    </div>
    <table className={styles.visuallyHidden}><caption>Ending-value distribution bins</caption><thead><tr><th>Start</th><th>End</th><th>Count</th></tr></thead><tbody>{bins.map((bin) => <tr key={bin.start}><td>{bin.start}</td><td>{bin.end}</td><td>{bin.count}</td></tr>)}</tbody></table>
  </figure>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function MissingAnalysis() {
  return <div className={styles.missing}><strong>Advanced analysis unavailable</strong><span>Run a new backtest to generate it.</span></div>;
}

function correlationBand(value: number | null): string {
  if (value === null) return "none";
  const magnitude = Math.abs(value);
  if (magnitude >= 0.75) return value >= 0 ? "positive-strong" : "negative-strong";
  if (magnitude >= 0.35) return value >= 0 ? "positive" : "negative";
  return "low";
}

function extent(values: number[]): [number, number] {
  if (!values.length) return [0, 1];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return [minimum - 1, maximum + 1];
  return [minimum, maximum];
}

function scale(value: number, [minimum, maximum]: [number, number], start: number, end: number): number {
  return start + (value - minimum) / (maximum - minimum) * (end - start);
}

function linePath(values: Array<number | null>, range: [number, number], left: number, right: number, top: number, bottom: number): string {
  const denominator = Math.max(values.length - 1, 1);
  return values.flatMap((value, index) => value === null ? [] : [`${index === 0 ? "M" : "L"}${left + index / denominator * (right - left)} ${scale(value, range, bottom, top)}`]).join(" ");
}

function histogramBins(values: Array<number | null>, count = 14) {
  const numeric = values.filter((value): value is number => value !== null);
  const [minimum, maximum] = extent(numeric);
  const width = (maximum - minimum) / count;
  const bins = Array.from({ length: count }, (_, index) => ({ start: minimum + index * width, end: minimum + (index + 1) * width, count: 0 }));
  for (const value of numeric) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - minimum) / width)));
    bins[index].count += 1;
  }
  return bins;
}

function formatNullableMoney(value: number | null, currency: string): string {
  return value === null ? "N/A" : formatMoney(value, currency);
}
