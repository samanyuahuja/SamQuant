"use client";

import { useRef } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type ResponsiveLayouts,
} from "react-grid-layout";

import type { BacktestRequest, BacktestResponse } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/workspace-store";
import type { WorkspaceBreakpoint, WorkspaceLayouts } from "@/lib/workspace-types";
import { WorkspaceWidgetCard } from "./workspace-widgets";
import styles from "./workspace.module.css";

const BREAKPOINTS = { desktop: 900, tablet: 560, mobile: 0 };
const COLUMNS = { desktop: 12, tablet: 8, mobile: 1 };

export function WidgetGrid({
  report,
  request,
  loading,
}: {
  report: BacktestResponse;
  request: BacktestRequest;
  loading: boolean;
}) {
  const widgets = useWorkspaceStore((state) => state.widgets);
  const storedLayouts = useWorkspaceStore((state) => state.layouts);
  const saveLayouts = useWorkspaceStore((state) => state.setLayouts);
  const draftRef = useRef(storedLayouts);
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: false, initialWidth: 1200 });

  function updateDraft(_: unknown, layouts: ResponsiveLayouts<WorkspaceBreakpoint>) {
    draftRef.current = layouts;
  }

  function commitLayout() {
    saveLayouts(draftRef.current as WorkspaceLayouts);
  }

  return (
    <div ref={containerRef} className={styles.gridHost}>
      {mounted && (
        <ResponsiveGridLayout<WorkspaceBreakpoint>
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLUMNS}
          layouts={storedLayouts}
          rowHeight={56}
          margin={{ desktop: [10, 10], tablet: [8, 8], mobile: [8, 8] }}
          containerPadding={{ desktop: [12, 12], tablet: [10, 10], mobile: [8, 8] }}
          dragConfig={{ enabled: true, handle: ".workspace-drag-handle", cancel: "button:not(.workspace-drag-handle), input, select, a, [role='table']", threshold: 4 }}
          resizeConfig={{ enabled: true, handles: ["se", "s", "e"] }}
          onLayoutChange={updateDraft}
          onDragStop={commitLayout}
          onResizeStop={commitLayout}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <WorkspaceWidgetCard widget={widget} report={report} request={request} loading={loading} />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
