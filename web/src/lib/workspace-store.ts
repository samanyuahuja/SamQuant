"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  appendWidgetToLayouts,
  DEFAULT_LAYOUTS,
  DEFAULT_WIDGETS,
  type WidgetKind,
  WIDGET_DEFINITIONS,
  type WorkspaceLayouts,
  type WorkspaceWidget,
} from "@/lib/workspace-types";

interface WorkspaceSnapshot {
  widgets: WorkspaceWidget[];
  layouts: WorkspaceLayouts;
}

interface WorkspaceState extends WorkspaceSnapshot {
  selectedWidgetId: string | null;
  fullscreenWidgetId: string | null;
  navCollapsed: boolean;
  inspectorOpen: boolean;
  commandOpen: boolean;
  past: WorkspaceSnapshot[];
  future: WorkspaceSnapshot[];
  selectWidget: (id: string | null) => void;
  setFullscreenWidget: (id: string | null) => void;
  setNavCollapsed: (collapsed: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setLayouts: (layouts: WorkspaceLayouts) => void;
  addWidget: (kind: WidgetKind) => string;
  duplicateWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  resetWorkspace: () => void;
  undo: () => void;
  redo: () => void;
}

let widgetSequence = 0;

export const useWorkspaceStore = create<WorkspaceState>()(persist(
  (set, get) => ({
    widgets: cloneWidgets(DEFAULT_WIDGETS),
    layouts: cloneLayouts(DEFAULT_LAYOUTS),
    selectedWidgetId: "price-signals",
    fullscreenWidgetId: null,
    navCollapsed: false,
    inspectorOpen: false,
    commandOpen: false,
    past: [],
    future: [],

    selectWidget: (selectedWidgetId) => set({ selectedWidgetId }),
    setFullscreenWidget: (fullscreenWidgetId) => set({ fullscreenWidgetId }),
    setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
    setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
    setCommandOpen: (commandOpen) => set({ commandOpen }),

    setLayouts: (layouts) => {
      if (sameLayouts(get().layouts, layouts)) return;
      pushChange(set, get, { widgets: get().widgets, layouts: cloneLayouts(layouts) });
    },

    addWidget: (kind) => {
      const id = `${kind}-${Date.now().toString(36)}-${widgetSequence++}`;
      const widget = { id, kind, title: WIDGET_DEFINITIONS[kind].title };
      pushChange(set, get, {
        widgets: [...get().widgets, widget],
        layouts: appendWidgetToLayouts(get().layouts, widget),
      });
      set({ selectedWidgetId: id });
      return id;
    },

    duplicateWidget: (id) => {
      const source = get().widgets.find((widget) => widget.id === id);
      if (source) get().addWidget(source.kind);
    },

    removeWidget: (id) => {
      const widgets = get().widgets.filter((widget) => widget.id !== id);
      const layouts = Object.fromEntries(
        Object.entries(get().layouts).map(([breakpoint, layout]) => [
          breakpoint,
          layout?.filter((item) => item.i !== id),
        ]),
      ) as WorkspaceLayouts;
      pushChange(set, get, { widgets, layouts });
      if (get().selectedWidgetId === id) set({ selectedWidgetId: widgets[0]?.id ?? null });
    },

    resetWorkspace: () => {
      pushChange(set, get, { widgets: cloneWidgets(DEFAULT_WIDGETS), layouts: cloneLayouts(DEFAULT_LAYOUTS) });
      set({ selectedWidgetId: "price-signals", fullscreenWidgetId: null });
    },

    undo: () => {
      const state = get();
      const previous = state.past.at(-1);
      if (!previous) return;
      set({
        ...cloneSnapshot(previous),
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, 30),
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        ...cloneSnapshot(next),
        past: [...state.past, snapshot(state)].slice(-30),
        future: state.future.slice(1),
      });
    },
  }),
  {
    name: "samquant.workspace.v3",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      widgets: state.widgets,
      layouts: state.layouts,
      navCollapsed: state.navCollapsed,
    }),
  },
));

function pushChange(
  set: (partial: Partial<WorkspaceState>) => void,
  get: () => WorkspaceState,
  next: WorkspaceSnapshot,
) {
  const state = get();
  set({
    widgets: cloneWidgets(next.widgets),
    layouts: cloneLayouts(next.layouts),
    past: [...state.past, snapshot(state)].slice(-30),
    future: [],
  });
}

function snapshot(state: WorkspaceSnapshot): WorkspaceSnapshot {
  return { widgets: cloneWidgets(state.widgets), layouts: cloneLayouts(state.layouts) };
}

function cloneSnapshot(value: WorkspaceSnapshot): WorkspaceSnapshot {
  return snapshot(value);
}

function cloneWidgets(widgets: WorkspaceWidget[]): WorkspaceWidget[] {
  return widgets.map((widget) => ({ ...widget }));
}

function cloneLayouts(layouts: WorkspaceLayouts): WorkspaceLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, layout]) => [
      breakpoint,
      layout?.map((item) => ({ ...item })),
    ]),
  ) as WorkspaceLayouts;
}

function sameLayouts(left: WorkspaceLayouts, right: WorkspaceLayouts): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
