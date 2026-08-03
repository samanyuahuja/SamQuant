"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("SamQuant route error", error);
  }, [error]);

  return (
    <main id="main-content" className="message-page">
      <p className="eyebrow">Request interrupted</p>
      <h1>The page could not finish loading.</h1>
      <p>Your research settings were not submitted. Try the page again.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}
