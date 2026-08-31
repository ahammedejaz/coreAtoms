/**
 * LegalPage.jsx — Shared scaffold for policy and info pages.
 *
 * Gives Terms, Privacy, Shipping, Refunds, FAQ and Contact one consistent
 * document treatment: an eyebrow label, a title, a last-updated line, and
 * prose-styled sections. Keeping the chrome here keeps each policy page down
 * to its actual content.
 *
 * @module pages/legal/LegalPage
 */
import SEO from "../../components/SEO";

export default function LegalPage({ eyebrow = "Core Atoms", title, updated, seoTitle, seoDescription, canonical, children }) {
    return (
        <div className="mx-auto max-w-3xl">
            <SEO title={seoTitle || title} description={seoDescription} canonical={canonical} />
            <div className="mb-10">
                <p className="section-label">{eyebrow}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900" style={{ textWrap: "balance" }}>{title}</h1>
                {updated && <p className="mt-2 text-xs text-stone-400">Last updated: {updated}</p>}
            </div>
            <div className="space-y-8">{children}</div>
        </div>
    );
}

/** One titled block of a legal document. */
export function LegalSection({ title, children }) {
    return (
        <section className="rounded-2xl border border-[#E8E4DE] bg-white p-6 sm:p-8">
            <h2 className="text-base font-semibold text-stone-900">{title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-600">{children}</div>
        </section>
    );
}

/** Inline definition row used on the contact page. */
export function InfoRow({ label, children }) {
    if (!children) return null;
    return (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 sm:w-36 shrink-0">{label}</span>
            <span className="text-sm text-stone-700">{children}</span>
        </div>
    );
}
