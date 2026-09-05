/**
 * LegalPage.jsx — Shared scaffold for policy and info pages.
 *
 * Gives Terms, Privacy, Shipping, Refunds and Contact one document
 * treatment: a title, a last-updated line, an "On this page" rail on wide
 * screens built from the section titles, and hairline-separated sections.
 *
 * @module pages/legal/LegalPage
 */
import { Children, isValidElement } from "react";
import SEO from "../../components/SEO";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function LegalPage({ title, updated, seoTitle, seoDescription, canonical, children }) {
    const sections = Children.toArray(children)
        .filter((c) => isValidElement(c) && c.props?.title)
        .map((c) => c.props.title);

    return (
        <div>
            <SEO title={seoTitle || title} description={seoDescription} canonical={canonical} />
            <div className="max-w-3xl">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">{title}</h1>
                {updated && <p className="mt-3 text-sm text-stone-500">Last updated {updated}</p>}
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
                {sections.length > 1 && (
                    <nav aria-label="On this page" className="hidden self-start lg:sticky lg:top-32 lg:block">
                        <p className="text-xs font-semibold text-stone-500">On this page</p>
                        <ul className="mt-3 border-l border-line">
                            {sections.map((t) => (
                                <li key={t}>
                                    <a href={`#${slug(t)}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-[13.5px] leading-snug text-stone-600 transition-colors hover:border-ink hover:text-ink">
                                        {t}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
                <div className={`max-w-3xl divide-y divide-line ${sections.length > 1 ? "" : "lg:col-span-2"}`}>{children}</div>
            </div>
        </div>
    );
}

/** One titled block of a legal document. */
export function LegalSection({ title, children }) {
    return (
        <section id={slug(title)} className="scroll-mt-32 py-8 first:pt-0 last:pb-0">
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-stone-600 [&_strong]:font-semibold [&_strong]:text-ink">{children}</div>
        </section>
    );
}

/** Inline definition row used on the contact page. */
export function InfoRow({ label, children }) {
    if (!children) return null;
    return (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="shrink-0 text-xs font-semibold text-stone-500 sm:w-32">{label}</span>
            <span className="text-[15px] text-ink">{children}</span>
        </div>
    );
}
