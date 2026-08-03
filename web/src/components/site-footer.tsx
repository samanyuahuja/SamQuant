import Link from "next/link";

import styles from "./site-footer.module.css";

const legal = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Disclaimer", "/disclaimer"],
  ["Data", "/data-and-attribution"],
  ["Accessibility", "/accessibility"],
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.primary}>
        <div>
          <p className={styles.brand}>SamQuant</p>
          <p className={styles.note}>Transparent strategy evaluation without hindsight or hype.</p>
        </div>
        <div className={styles.links}>
          <Link href="/research">Research terminal</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/architecture">Architecture</Link>
          <Link href="/changelog">Changelog</Link>
        </div>
      </div>
      <div className={styles.legal}>
        <p>Educational research software. Backtested results are hypothetical.</p>
        <nav aria-label="Legal navigation">
          {legal.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
