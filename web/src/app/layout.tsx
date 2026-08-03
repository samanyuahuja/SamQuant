import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SamQuant", template: "%s | SamQuant" },
  description: "A transparent algorithmic trading and backtesting research system.",
  applicationName: "SamQuant",
  authors: [{ name: "Samanyu Ahuja" }],
  openGraph: {
    title: "SamQuant",
    description: "Test the strategy. Not your luck.",
    type: "website",
    siteName: "SamQuant",
  },
  twitter: { card: "summary_large_image", title: "SamQuant" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a09",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
