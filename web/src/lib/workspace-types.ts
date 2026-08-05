import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";

export const WIDGET_KINDS = [
  "price",
  "price-signals",
  "equity",
  "drawdown",
  "strategy-benchmark",
  "metrics",
  "rolling-volatility",
  "rolling-sharpe",
  "monthly-returns",
  "return-distribution",
  "allocation",
  "trades",
  "signals",
  "parameters",
  "assumptions",
  "parameter-study",
  "explanation",
  "limitations",
] as const;

export type WidgetKind = (typeof WIDGET_KINDS)[number];
export type WorkspaceBreakpoint = "desktop" | "tablet" | "mobile";
export type WorkspaceLayouts = ResponsiveLayouts<WorkspaceBreakpoint>;

export interface WorkspaceWidget {
  id: string;
  kind: WidgetKind;
  title: string;
}

export interface WidgetDefinition {
  kind: WidgetKind;
  title: string;
  description: string;
  category: "Market" | "Performance" | "Risk" | "Execution" | "Research";
  size: Record<WorkspaceBreakpoint, { w: number; h: number; minW: number; minH: number }>;
}

const CHART_SIZE = {
  desktop: { w: 6, h: 6, minW: 4, minH: 4 },
  tablet: { w: 8, h: 6, minW: 4, minH: 4 },
  mobile: { w: 1, h: 6, minW: 1, minH: 4 },
};

const TABLE_SIZE = {
  desktop: { w: 12, h: 7, minW: 6, minH: 5 },
  tablet: { w: 8, h: 7, minW: 4, minH: 5 },
  mobile: { w: 1, h: 7, minW: 1, minH: 5 },
};

const TEXT_SIZE = {
  desktop: { w: 6, h: 5, minW: 4, minH: 4 },
  tablet: { w: 4, h: 5, minW: 4, minH: 4 },
  mobile: { w: 1, h: 5, minW: 1, minH: 4 },
};

export const WIDGET_DEFINITIONS: Record<WidgetKind, WidgetDefinition> = {
  price: { kind: "price", title: "Price", description: "Clean OHLC price history.", category: "Market", size: CHART_SIZE },
  "price-signals": { kind: "price-signals", title: "Price + signals", description: "Indicators, entries, and exits.", category: "Market", size: CHART_SIZE },
  equity: { kind: "equity", title: "Portfolio equity", description: "Account value through time.", category: "Performance", size: CHART_SIZE },
  drawdown: { kind: "drawdown", title: "Drawdown", description: "Loss from each prior peak.", category: "Risk", size: CHART_SIZE },
  "strategy-benchmark": { kind: "strategy-benchmark", title: "Strategy vs benchmark", description: "Normalized performance comparison.", category: "Performance", size: CHART_SIZE },
  metrics: { kind: "metrics", title: "Core metrics", description: "Return and risk summary.", category: "Performance", size: TEXT_SIZE },
  "rolling-volatility": { kind: "rolling-volatility", title: "Rolling volatility", description: "Twenty-day variability estimate.", category: "Risk", size: CHART_SIZE },
  "rolling-sharpe": { kind: "rolling-sharpe", title: "Rolling Sharpe", description: "Twenty-day risk-adjusted return estimate.", category: "Risk", size: CHART_SIZE },
  "monthly-returns": { kind: "monthly-returns", title: "Monthly returns", description: "Calendar return heatmap.", category: "Performance", size: CHART_SIZE },
  "return-distribution": { kind: "return-distribution", title: "Return distribution", description: "Shape of daily portfolio returns.", category: "Risk", size: CHART_SIZE },
  allocation: { kind: "allocation", title: "Latest allocation", description: "Cash and current position weights.", category: "Execution", size: CHART_SIZE },
  trades: { kind: "trades", title: "Executed trades", description: "Sortable trade ledger.", category: "Execution", size: TABLE_SIZE },
  signals: { kind: "signals", title: "Strategy signals", description: "Generated target-weight decisions.", category: "Execution", size: TABLE_SIZE },
  parameters: { kind: "parameters", title: "Run parameters", description: "Exact strategy configuration.", category: "Research", size: TEXT_SIZE },
  assumptions: { kind: "assumptions", title: "Assumptions", description: "Rules behind the simulation.", category: "Research", size: TEXT_SIZE },
  "parameter-study": { kind: "parameter-study", title: "Parameter study", description: "Selection and validation ranking.", category: "Research", size: TABLE_SIZE },
  explanation: { kind: "explanation", title: "Research readout", description: "Plain-language result interpretation.", category: "Research", size: TEXT_SIZE },
  limitations: { kind: "limitations", title: "Limits and warnings", description: "What this result cannot prove.", category: "Research", size: TEXT_SIZE },
};

export const DEFAULT_WIDGETS: WorkspaceWidget[] = [
  { id: "price-signals", kind: "price-signals", title: "Price + signals" },
  { id: "metrics", kind: "metrics", title: "Core metrics" },
  { id: "equity", kind: "equity", title: "Portfolio equity" },
  { id: "strategy-benchmark", kind: "strategy-benchmark", title: "Strategy vs benchmark" },
  { id: "drawdown", kind: "drawdown", title: "Drawdown" },
  { id: "parameter-study", kind: "parameter-study", title: "Parameter study" },
  { id: "trades", kind: "trades", title: "Executed trades" },
  { id: "explanation", kind: "explanation", title: "Research readout" },
  { id: "assumptions", kind: "assumptions", title: "Assumptions" },
];

export const DEFAULT_LAYOUTS: WorkspaceLayouts = {
  desktop: [
    item("price-signals", 0, 0, 8, 7, 4, 5),
    item("metrics", 8, 0, 4, 7, 3, 5),
    item("equity", 0, 7, 6, 6, 4, 4),
    item("strategy-benchmark", 6, 7, 6, 6, 4, 4),
    item("drawdown", 0, 13, 5, 6, 4, 4),
    item("parameter-study", 5, 13, 7, 8, 6, 5),
    item("trades", 0, 21, 12, 7, 6, 5),
    item("explanation", 0, 28, 7, 6, 4, 4),
    item("assumptions", 7, 28, 5, 6, 4, 4),
  ],
  tablet: verticalLayout(DEFAULT_WIDGETS, "tablet", 8),
  mobile: verticalLayout(DEFAULT_WIDGETS, "mobile", 1),
};

export function appendWidgetToLayouts(
  layouts: WorkspaceLayouts,
  widget: WorkspaceWidget,
): WorkspaceLayouts {
  const definition = WIDGET_DEFINITIONS[widget.kind];
  return (Object.keys(definition.size) as WorkspaceBreakpoint[]).reduce<WorkspaceLayouts>((next, breakpoint) => {
    const current = [...(layouts[breakpoint] ?? [])];
    const size = definition.size[breakpoint];
    const y = current.reduce((bottom, layout) => Math.max(bottom, layout.y + layout.h), 0);
    next[breakpoint] = [...current, item(widget.id, 0, y, size.w, size.h, size.minW, size.minH)];
    return next;
  }, {});
}

function verticalLayout(widgets: WorkspaceWidget[], breakpoint: WorkspaceBreakpoint, columns: number): LayoutItem[] {
  let y = 0;
  return widgets.map((widget) => {
    const size = WIDGET_DEFINITIONS[widget.kind].size[breakpoint];
    const layout = item(widget.id, 0, y, Math.min(size.w, columns), size.h, Math.min(size.minW, columns), size.minH);
    y += size.h;
    return layout;
  });
}

function item(i: string, x: number, y: number, w: number, h: number, minW: number, minH: number): LayoutItem {
  return { i, x, y, w, h, minW, minH };
}
