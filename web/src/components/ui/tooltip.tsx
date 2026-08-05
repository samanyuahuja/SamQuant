"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import styles from "./primitives.module.css";

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className={styles.tooltip} sideOffset={7}>
          {label}
          <TooltipPrimitive.Arrow className={styles.tooltipArrow} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
