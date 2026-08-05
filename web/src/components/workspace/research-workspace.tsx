"use client";

import {
  ArrowLeftRight,
  BookOpen,
  Braces,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  Database,
  Download,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Menu,
  PanelRight,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Group, Panel, Separator } from "react-resizable-panels";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import type { BacktestRequest, BacktestResponse } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { WIDGET_DEFINITIONS, type WidgetKind } from "@/lib/workspace-types";
import { CommandPalette } from "./command-palette";
import { WidgetGrid } from "./widget-grid";
import styles from "./workspace.module.css";

type ResultView = "performance" | "drawdown" | "trades" | "comparison" | "study";

const VIEWS: { id: ResultView; label: string; widget: WidgetKind }[] = [
  { id: "performance", label: "Performance", widget: "equity" },
  { id: "drawdown", label: "Drawdown", widget: "drawdown" },
  { id: "trades", label: "Trades", widget: "trades" },
  { id: "comparison", label: "Comparison", widget: "strategy-benchmark" },
  { id: "study", label: "Parameter study", widget: "parameter-study" },
];

export function ResearchWorkspace({
  report,
  request,
  loading,
  ready,
  controlsOpen,
  error,
  inspector,
  onToggleSetup,
  onRun,
  onResetRequest,
  onDownloadJson,
  onDownloadTrades,
}: {
  report: BacktestResponse;
  request: BacktestRequest;
  loading: boolean;
  ready: boolean;
  controlsOpen: boolean;
  error: string | null;
  inspector: React.ReactNode;
  onToggleSetup: () => void;
  onRun: () => void;
  onResetRequest: () => void;
  onDownloadJson: () => void;
  onDownloadTrades: () => void;
}) {
  const [activeView, setActiveView] = useState<ResultView>("performance");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const compact = useCompactViewport();
  const navCollapsed = useWorkspaceStore((state) => state.navCollapsed);
  const setNavCollapsed = useWorkspaceStore((state) => state.setNavCollapsed);
  const inspectorOpen = useWorkspaceStore((state) => state.inspectorOpen);
  const setInspectorOpen = useWorkspaceStore((state) => state.setInspectorOpen);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const selectedWidgetId = useWorkspaceStore((state) => state.selectedWidgetId);
  const widgets = useWorkspaceStore((state) => state.widgets);
  const selectWidget = useWorkspaceStore((state) => state.selectWidget);
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);
  const canUndo = useWorkspaceStore((state) => state.past.length > 0);
  const canRedo = useWorkspaceStore((state) => state.future.length > 0);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [setCommandOpen]);

  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId) ?? null;
  const canvas = (
    <CenterWorkspace
      report={report}
      request={request}
      loading={loading}
      ready={ready}
      activeView={activeView}
      error={error}
      compact={compact}
      controlsOpen={controlsOpen}
      canUndo={canUndo}
      canRedo={canRedo}
      onToggleSetup={() => { onToggleSetup(); setInspectorOpen(!controlsOpen); }}
      onRun={onRun}
      onResetRequest={onResetRequest}
      onDownloadJson={onDownloadJson}
      onDownloadTrades={onDownloadTrades}
      onSetView={(view) => {
        setActiveView(view);
        focusWidget(VIEWS.find((item) => item.id === view)!.widget, widgets, addWidget, selectWidget);
      }}
      onUndo={undo}
      onRedo={redo}
      onResetWorkspace={resetWorkspace}
      onOpenNav={() => setMobileNavOpen(true)}
      onOpenCommand={() => setCommandOpen(true)}
    />
  );

  const inspectorPanel = (
    <InspectorPanel
      controlsOpen={controlsOpen}
      selectedWidget={selectedWidget}
      request={request}
      report={report}
      onToggleSetup={onToggleSetup}
      onClose={() => setInspectorOpen(false)}
    >
      {inspector}
    </InspectorPanel>
  );

  return (
    <main id="main-content" className={styles.main} data-ready={ready} data-route="research" aria-busy={!ready || loading}>
      <div className={styles.shell} data-nav-collapsed={navCollapsed || undefined}>
        <WorkspaceNav
          collapsed={navCollapsed}
          mobileOpen={mobileNavOpen}
          onCollapse={() => setNavCollapsed(!navCollapsed)}
          onCloseMobile={() => setMobileNavOpen(false)}
          onOpenCommand={() => setCommandOpen(true)}
          onFocusCompare={() => {
            setActiveView("comparison");
            focusWidget("strategy-benchmark", widgets, addWidget, selectWidget);
            setMobileNavOpen(false);
          }}
        />
        {compact ? (
          <div className={styles.compactWorkspace}>
            {canvas}
            <aside className={styles.mobileInspector} data-open={(inspectorOpen || controlsOpen) || undefined}>{inspectorPanel}</aside>
          </div>
        ) : (
          <Group orientation="horizontal" className={styles.panelGroup} defaultLayout={{ canvas: 78, inspector: 22 }}>
            <Panel id="canvas" minSize="620px">{canvas}</Panel>
            <Separator className={styles.panelSeparator} aria-label="Resize research inspector"><span /></Separator>
            <Panel id="inspector" defaultSize="310px" minSize="270px" maxSize="410px" collapsible collapsedSize={0}>
              <aside className={styles.desktopInspector} data-open={inspectorOpen || undefined}>{inspectorPanel}</aside>
            </Panel>
          </Group>
        )}
      </div>
      {loading && <div className={styles.runStatus} role="status">Running the Python research engine</div>}
      <CommandPalette onOpenSetup={() => { if (!controlsOpen) onToggleSetup(); setInspectorOpen(true); }} />
    </main>
  );
}

function CenterWorkspace({
  report,
  request,
  loading,
  ready,
  activeView,
  error,
  compact,
  controlsOpen,
  canUndo,
  canRedo,
  onToggleSetup,
  onRun,
  onResetRequest,
  onDownloadJson,
  onDownloadTrades,
  onSetView,
  onUndo,
  onRedo,
  onResetWorkspace,
  onOpenNav,
  onOpenCommand,
}: {
  report: BacktestResponse;
  request: BacktestRequest;
  loading: boolean;
  ready: boolean;
  activeView: ResultView;
  error: string | null;
  compact: boolean;
  controlsOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleSetup: () => void;
  onRun: () => void;
  onResetRequest: () => void;
  onDownloadJson: () => void;
  onDownloadTrades: () => void;
  onSetView: (view: ResultView) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetWorkspace: () => void;
  onOpenNav: () => void;
  onOpenCommand: () => void;
}) {
  return <section className={styles.centerWorkspace} aria-live="polite">
    <header className={styles.topbar}>
      <button className={styles.mobileOnlyButton} type="button" aria-label="Open navigation" onClick={onOpenNav}><Menu size={17} /></button>
      <div className={styles.researchContext}>
        <p>Backtest research / {report.metadata.symbols.join(" + ")}</p>
        <div><h1>{report.metadata.strategyLabel}</h1><span>{report.metadata.market}</span><span>{report.metadata.start} → {report.metadata.end}</span></div>
      </div>
      <button className={styles.commandButton} type="button" onClick={onOpenCommand}><CommandIcon size={14} /><span>Research command</span><kbd>⌘K</kbd></button>
      <div className={styles.topActions}>
        <Tooltip label="Undo layout"><button type="button" aria-label="Undo layout" disabled={!canUndo} onClick={onUndo}><Undo2 size={15} /></button></Tooltip>
        <Tooltip label="Redo layout"><button type="button" aria-label="Redo layout" disabled={!canRedo} onClick={onRedo}><Redo2 size={15} /></button></Tooltip>
        <Tooltip label="Reset workspace"><button type="button" aria-label="Reset workspace" onClick={onResetWorkspace}><LayoutDashboard size={15} /></button></Tooltip>
        <details className={styles.exportMenu}>
          <summary title="Export results"><Download size={15} /><span className={styles.visuallyHidden}>Export results</span></summary>
          <div><button type="button" onClick={onDownloadJson}>JSON report</button><button type="button" onClick={onDownloadTrades}>Trades CSV</button></div>
        </details>
        {!compact && <button className={styles.setupButton} type="button" aria-label={controlsOpen ? "Close setup" : "Edit setup"} aria-expanded={controlsOpen} onClick={onToggleSetup}><SlidersHorizontal size={15} /><span>{controlsOpen ? "Close setup" : "Edit setup"}</span></button>}
        <button className={styles.runButton} type="submit" form="backtest-form" disabled={loading} onClick={onRun}><Play size={14} fill="currentColor" />{loading ? "Running backtest" : "Run backtest"}</button>
        {compact && <button className={styles.mobileOnlyButton} type="button" aria-label={controlsOpen ? "Close setup" : "Edit setup"} aria-expanded={controlsOpen} onClick={onToggleSetup}><PanelRight size={17} /></button>}
      </div>
    </header>
    <nav className={styles.viewTabs} role="tablist" aria-label="Research results">
      {VIEWS.map((view) => <button key={view.id} type="button" role="tab" aria-selected={activeView === view.id} onClick={() => onSetView(view.id)}>{view.label}</button>)}
    </nav>
    <div className={styles.errorSlot}>
      {error && <div className={styles.errorBanner} role="alert"><strong>Backtest not run</strong><span>{error}</span></div>}
    </div>
    <div className={styles.canvasScroll}>
      <div className={styles.canvasIntro}><span>WORKSPACE / 01</span><p>Drag headers. Resize corners. Changes save here.</p></div>
      <WidgetGrid report={report} request={request} loading={loading} />
    </div>
    <footer className={styles.statusbar}>
      <span><i data-status={loading || !ready ? "busy" : "ready"} />{loading ? "Engine busy" : ready ? "Research engine ready" : "Restoring workspace"}</span>
      <span>{report.metadata.dataSource === "demo" ? "Deterministic demo" : "Yahoo Finance"}</span>
      <span>{report.metadata.version}</span>
      <button type="button" onClick={onResetRequest}><RotateCcw size={12} /> Reset experiment</button>
    </footer>
  </section>;
}

function WorkspaceNav({
  collapsed,
  mobileOpen,
  onCollapse,
  onCloseMobile,
  onOpenCommand,
  onFocusCompare,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onCloseMobile: () => void;
  onOpenCommand: () => void;
  onFocusCompare: () => void;
}) {
  return <aside className={styles.workspaceNav} data-mobile-open={mobileOpen || undefined}>
    <header>
      <Link href="/" aria-label="SamQuant home"><span>SQ</span><strong>SamQuant</strong></Link>
      <button type="button" aria-label="Close navigation" className={styles.mobileNavClose} onClick={onCloseMobile}><X size={17} /></button>
    </header>
    <nav aria-label="Workspace navigation">
      <Link href="/research" aria-current="page"><FlaskConical size={16} /><span>Research</span></Link>
      <Link href="/methodology#strategies"><Braces size={16} /><span>Strategies</span></Link>
      <button type="button" onClick={onFocusCompare}><ArrowLeftRight size={16} /><span>Compare</span></button>
      <Link href="/data-and-attribution"><Database size={16} /><span>Data</span></Link>
      <Link href="/docs"><BookOpen size={16} /><span>Documentation</span></Link>
    </nav>
    <div className={styles.navMeta}>
      <button type="button" onClick={onOpenCommand}><Plus size={15} /><span>Add widget</span></button>
      <a href="https://github.com/samanyuahuja/SamQuant" target="_blank" rel="noreferrer"><GitBranch size={15} /><span>Source code</span></a>
      <div><i /><span>Research only</span></div>
    </div>
    <button className={styles.collapseNav} type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onCollapse}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}<span>Collapse</span></button>
  </aside>;
}

function InspectorPanel({
  controlsOpen,
  selectedWidget,
  request,
  report,
  onToggleSetup,
  onClose,
  children,
}: {
  controlsOpen: boolean;
  selectedWidget: { id: string; kind: WidgetKind; title: string } | null;
  request: BacktestRequest;
  report: BacktestResponse;
  onToggleSetup: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const definition = selectedWidget ? WIDGET_DEFINITIONS[selectedWidget.kind] : null;
  return <div className={styles.inspectorPanel}>
    <header><div><span>INSPECTOR</span><h2>{controlsOpen ? "Experiment setup" : selectedWidget?.title ?? "Workspace"}</h2></div><button type="button" aria-label="Close inspector" onClick={onClose}><X size={15} /></button></header>
    <div className={styles.inspectorControls} data-open={controlsOpen || undefined}>{children}</div>
    {!controlsOpen && <div className={styles.inspectorSummary}>
      <section><span>Selected widget</span><p>{definition?.description ?? "Select a widget to inspect it."}</p><dl><div><dt>Type</dt><dd>{definition?.category ?? "None"}</dd></div><div><dt>Data through</dt><dd>{report.metadata.end}</dd></div></dl></section>
      <section><span>Active experiment</span><p>{request.symbols.join(" + ")} · {report.metadata.strategyLabel}</p><dl><div><dt>Market</dt><dd>{request.market}</dd></div><div><dt>Source</dt><dd>{request.data_source}</dd></div><div><dt>Trades</dt><dd>{report.trades.length}</dd></div></dl></section>
      <button type="button" onClick={onToggleSetup}><SlidersHorizontal size={14} /> Edit experiment</button>
      <p className={styles.inspectorNote}>Widgets read the latest Python report. Layout edits never alter calculations.</p>
    </div>}
  </div>;
}

function focusWidget(
  kind: WidgetKind,
  widgets: { id: string; kind: WidgetKind }[],
  addWidget: (kind: WidgetKind) => string,
  selectWidget: (id: string | null) => void,
) {
  const id = widgets.find((widget) => widget.kind === kind)?.id ?? addWidget(kind);
  selectWidget(id);
  window.setTimeout(() => {
    const element = document.querySelector(`[data-widget-id="${id}"]`);
    if (element && "scrollIntoView" in element) element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 40);
}

function useCompactViewport(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia("(max-width: 900px)");
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia("(max-width: 900px)").matches,
    () => false,
  );
}
