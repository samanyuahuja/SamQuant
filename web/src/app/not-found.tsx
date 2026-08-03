import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="message-page">
      <p className="eyebrow">404 / no observation</p>
      <h1>No data exists at this route.</h1>
      <p>The address is outside SamQuant&apos;s current research set.</p>
      <Link className="text-link" href="/">Return to SamQuant</Link>
    </main>
  );
}
