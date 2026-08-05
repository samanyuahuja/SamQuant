"use client";

import { Command } from "cmdk";
import { LayoutDashboard, RotateCcw, Search, SlidersHorizontal, Undo2 } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { WIDGET_DEFINITIONS, WIDGET_KINDS, type WidgetKind } from "@/lib/workspace-types";
import styles from "./workspace.module.css";

export function CommandPalette({ onOpenSetup }: { onOpenSetup: () => void }) {
  const open = useWorkspaceStore((state) => state.commandOpen);
  const setOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const addWidget = useWorkspaceStore((state) => state.addWidget);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);
  const undo = useWorkspaceStore((state) => state.undo);

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Research commands" className={styles.commandDialog}>
        <Command className={styles.command} label="Research commands">
          <div className={styles.commandInput}>
            <Search aria-hidden="true" size={16} />
            <Command.Input autoFocus placeholder="Try ‘show drawdown’ or ‘add trade table’" />
            <kbd>ESC</kbd>
          </div>
          <Command.List>
            <Command.Empty>No matching research command.</Command.Empty>
            <Command.Group heading="Workspace">
              <Command.Item onSelect={() => run(onOpenSetup)} keywords={["configure experiment", "change strategy"]}>
                <SlidersHorizontal size={15} /><span>Edit backtest setup</span><small>Market, strategy, costs</small>
              </Command.Item>
              <Command.Item onSelect={() => run(undo)} keywords={["undo layout", "previous layout"]}>
                <Undo2 size={15} /><span>Undo layout change</span><small>Restore prior canvas</small>
              </Command.Item>
              <Command.Item onSelect={() => run(resetWorkspace)} keywords={["reset layout", "default workspace"]}>
                <RotateCcw size={15} /><span>Reset workspace</span><small>Restore default widgets</small>
              </Command.Item>
            </Command.Group>
            {(["Market", "Performance", "Risk", "Execution", "Research"] as const).map((category) => (
              <Command.Group key={category} heading={category}>
                {WIDGET_KINDS.filter((kind) => WIDGET_DEFINITIONS[kind].category === category).map((kind) => (
                  <WidgetCommand key={kind} kind={kind} onSelect={() => run(() => addWidget(kind))} />
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <footer className={styles.commandFooter}><span>Predefined workspace actions only</span><span><kbd>↑↓</kbd> move <kbd>↵</kbd> run</span></footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function WidgetCommand({ kind, onSelect }: { kind: WidgetKind; onSelect: () => void }) {
  const definition = WIDGET_DEFINITIONS[kind];
  return (
    <Command.Item onSelect={onSelect} keywords={[`show ${definition.title}`, `add ${definition.title}`, definition.description]}>
      <LayoutDashboard size={15} />
      <span>Add {definition.title}</span>
      <small>{definition.description}</small>
    </Command.Item>
  );
}
