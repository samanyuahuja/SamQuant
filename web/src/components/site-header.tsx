import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";

import { BrandMark } from "./brand-mark";
import styles from "./site-header.module.css";

const navigation = [
  { href: "/research", label: "Research" },
  { href: "/methodology", label: "Methodology" },
  { href: "/architecture", label: "Architecture" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="SamQuant home">
          <BrandMark />
        </Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <span className={styles.status}><i aria-hidden="true" /> Research only</span>
          <a
            className={styles.github}
            href="https://github.com/samanyuahuja/SamQuant"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ExternalLink aria-hidden="true" size={13} />
          </a>
          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation"><Menu aria-hidden="true" size={20} /></summary>
            <nav aria-label="Mobile navigation">
              {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
              <Link href="/about">About</Link>
              <Link href="/changelog">Changelog</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
