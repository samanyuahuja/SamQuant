"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef } from "react";

import styles from "./primitives.module.css";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string }
>(({ children, className = "", title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={styles.dialogOverlay} />
    <DialogPrimitive.Content ref={ref} className={`${styles.dialogContent} ${className}`} {...props}>
      <DialogPrimitive.Title className={styles.dialogTitle}>{title}</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close className={styles.dialogClose} aria-label="Close dialog">
        <X aria-hidden="true" size={17} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
