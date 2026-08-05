"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
      mutations: { retry: 0 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipPrimitive.Provider delayDuration={350}>
        {children}
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}
