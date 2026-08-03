import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="message-page">
      <p className="eyebrow">404</p>
      <h1>This page is outside the model.</h1>
      <p>The requested route does not exist.</p>
      <Link className="text-link" href="/">Return home</Link>
    </main>
  );
}
