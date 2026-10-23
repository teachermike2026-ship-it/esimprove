import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { ArrowRight, ClockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "eSIM install guides",
  description:
    "Provider-neutral guides for checking compatibility and installing an eSIM on iOS or Android.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Help centre</p>
          <h1>Install guides</h1>
          <p className="lead">
            General, provider-neutral guidance for checking a device and installing an eSIM.
            Exact menus vary by manufacturer and OS version.
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        {guides.map((guide) => (
          <article key={guide.slug} className="card form">
            <p className="eyebrow">
              <ClockIcon className="inline-icon" /> {guide.readingTime}
            </p>
            <h2>
              <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
            </h2>
            <p className="muted">{guide.summary}</p>
            <Link className="button button-ghost button-small" href={`/guides/${guide.slug}`}>
              Read guide <ArrowRight className="inline-icon" />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
