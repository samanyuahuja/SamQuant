import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditorialPage } from "@/components/editorial-page";
import { CONTENT_PAGES, CONTENT_SLUGS } from "@/lib/site-content";

interface PageProps { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return CONTENT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = CONTENT_PAGES[slug];
  return page ? { title: page.title, description: page.summary } : {};
}

export default async function ContentRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = CONTENT_PAGES[slug];
  if (!page) notFound();
  return <EditorialPage page={page} />;
}
