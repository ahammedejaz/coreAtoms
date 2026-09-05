/**
 * FAQPage.jsx — Store-wide frequently asked questions.
 *
 * Every question and answer comes from the `page_faq` content key (Admin →
 * Site content → FAQ), grouped by topic; the defaults in
 * `content/siteContent.js` describe how the store actually works, so if a
 * flow changes, change the answer. Product-specific FAQs live on each
 * product page (from the `details` JSONB), not here.
 *
 * FAQPage structured data is emitted so search engines can show these
 * directly, matching what the PDP already does for product FAQs.
 *
 * @module pages/legal/FAQPage
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";
import FaqItem from "../../components/FaqItem";
import RevealText from "../../components/fx/RevealText";
import { useSiteContent } from "../../services/siteContent";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function FAQPage() {
    const [openId, setOpenId] = useState(null);
    const copy = useSiteContent("page_faq");
    const groups = (copy.groups || []).filter((g) => g?.section && Array.isArray(g.items) && g.items.length > 0);

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: groups.flatMap((s) => s.items).map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
    };

    return (
        <div>
            <SEO
                title="FAQ"
                description="Answers about ordering, payment, shipping, cancellations, replacements and CoreCoins at Core Atoms."
                canonical="/faq"
            />
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

            <div className="max-w-3xl">
                <RevealText as="h1" text={copy.title} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
                <p className="mt-3 text-[15px] text-stone-600">
                    {copy.intro}{" "}
                    <Link to="/contact" className="font-semibold text-brand underline underline-offset-4">Contact us</Link>.
                </p>
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
                <nav aria-label="Topics" className="hidden self-start lg:sticky lg:top-32 lg:block">
                    <p className="text-xs font-semibold text-stone-500">Topics</p>
                    <ul className="mt-3 border-l border-line">
                        {groups.map((group) => (
                            <li key={group.section}>
                                <a href={`#${slug(group.section)}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-[13.5px] leading-snug text-stone-600 transition-colors hover:border-ink hover:text-ink">
                                    {group.section}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="max-w-3xl space-y-12">
                    {groups.map((group) => (
                        <section key={group.section} id={slug(group.section)} className="scroll-mt-32">
                            <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">{group.section}</h2>
                            <div className="mt-3 divide-y divide-line border-y border-line">
                                {group.items.map((f) => {
                                    const id = `${group.section}::${f.q}`;
                                    return (
                                        <FaqItem key={id} q={f.q} a={f.a}
                                            open={openId === id}
                                            onToggle={() => setOpenId(openId === id ? null : id)} />
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
