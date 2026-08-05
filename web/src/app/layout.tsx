import type { Metadata, Viewport } from "next";

import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource-variable/ibm-plex-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AppProviders } from "@/app/providers";
import "react-grid-layout/css/styles.css";
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
    images: [{ url: "/social/open-graph.png", width: 1200, height: 630, alt: "SamQuant research system" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SamQuant",
    description: "Test the strategy. Not your luck.",
    images: ["/social/open-graph.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#171a18" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <AppProviders>
          <SiteHeader />
          {children}
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
