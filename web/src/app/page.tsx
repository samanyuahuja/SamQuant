import type { Metadata } from "next";

import { LandingStory } from "@/components/landing-story";
import demoReport from "@/data/demo-backtest.json";
import strategyDemos from "@/data/demo-strategies.json";
import type { BacktestResponse, StrategyId } from "@/lib/types";

export const metadata: Metadata = {
  title: "SamQuant",
  description: "Test trading strategies through a transparent historical simulation pipeline.",
};

export default function HomePage() {
  return (
    <LandingStory
      report={demoReport as BacktestResponse}
      strategyDemos={strategyDemos as Record<StrategyId, never>}
    />
  );
}
