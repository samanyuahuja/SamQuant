import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import type { ContentPage } from "@/lib/site-content";
import styles from "./editorial-page.module.css";

export function EditorialPage({ page }: { page: ContentPage }) {
  return (
    <main id="main-content" className={styles.main}>
      <header className={styles.hero}>
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
      </header>
      <div className={styles.sections}>
        {page.sections.map((section, index) => (
          <section key={section.title} className={styles.section}>
            <p className={styles.index}>{String(index + 1).padStart(2, "0")}</p>
            <div>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.points && (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}><Check aria-hidden="true" size={15} />{point}</li>
                  ))}
                </ul>
              )}
              {section.code && <pre><code>{section.code}</code></pre>}
              {section.links && (
                <div className={styles.links}>
                  {section.links.map((link) => (
                    <Link key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined}>
                      {link.label}<ArrowUpRight aria-hidden="true" size={15} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
