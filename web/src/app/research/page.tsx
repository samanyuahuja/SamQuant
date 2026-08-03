import type { Metadata } from "next";

import { ResearchTerminal } from "@/components/research-terminal";
import demoReport from "@/data/demo-backtest.json";
import type { BacktestResponse } from "@/lib/types";

export const metadata: Metadata = {
  title: "Research Terminal",
  description: "Configure and run a transparent historical strategy backtest.",
};

export default function ResearchPage() {
  return <ResearchTerminal initialReport={demoReport as BacktestResponse} />;
}
