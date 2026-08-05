"use client";

import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { useEffect, useRef } from "react";

import styles from "./workspace.module.css";

export function QuantEChart({ option, label }: { option: EChartsOption; label: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const chart = echarts.init(host.current, undefined, { renderer: "canvas" });
    chart.setOption(option, { notMerge: true });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={host} className={styles.echart} role="img" aria-label={label} />;
}
