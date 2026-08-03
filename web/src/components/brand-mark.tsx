import styles from "./brand-mark.module.css";

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
}

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  return (
    <span className={`${styles.lockup} ${inverse ? styles.inverse : ""}`}>
      <svg
        className={styles.mark}
        viewBox="0 0 32 32"
        role="img"
        aria-label={compact ? "SamQuant" : undefined}
        aria-hidden={compact ? undefined : true}
      >
        <circle cx="15.5" cy="15.5" r="11" />
        <path d="M9.5 11.6c1.6-2.5 9-2.4 10 1.1 1 3.5-9.1 2.6-8.7 6.2.3 3.4 7.8 3.5 10.2.7" />
        <path d="m19.2 19.1 6.3 6.3" />
      </svg>
      {!compact && <span className={styles.wordmark}>SamQuant</span>}
    </span>
  );
}
