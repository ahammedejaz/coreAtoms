/**
 * FAQPage.jsx — Store-wide frequently asked questions.
 *
 * Covers ordering, payments, shipping, replacements and CoreCoins. Answers
 * describe how the store actually works — if a flow changes, change the
 * answer. Product-specific FAQs live on each product page (from the
 * `details` JSONB), not here.
 *
 * FAQPage structured data is emitted so search engines can show these
 * directly, matching what the PDP already does for product FAQs.
 *
 * @module pages/legal/FAQPage
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../../components/SEO";

const FAQS = [
    {
        section: "Ordering & payment",
        items: [
            {
                q: "What payment methods do you accept?",
                a: "Online payment via Razorpay — UPI, credit and debit cards, netbanking and wallets — and Cash on Delivery on serviceable pincodes. Your card details never touch our servers; payment is processed entirely by Razorpay.",
            },
            {
                q: "Is Cash on Delivery available?",
                a: "Yes, on most serviceable pincodes across India. The amount collected at your door is exactly the order total shown at checkout — nothing is added at delivery.",
            },
            {
                q: "How do I apply a coupon code?",
                a: "Enter the code at checkout before paying. The discount is applied to your product subtotal, and GST is calculated on the discounted amount, so you always see the final figure before confirming.",
            },
            {
                q: "Can I change an order after placing it?",
                a: "Orders can't be edited after placement, but while an order is still Placed or Processing you can cancel it instantly from My Orders and place a fresh one.",
            },
        ],
    },
    {
        section: "Shipping & delivery",
        items: [
            {
                q: "How long does delivery take?",
                a: "Orders are typically dispatched within 1–2 business days. Metros usually receive them 3–5 business days after dispatch, other locations 5–7, and remote pincodes up to 10. Enter your pincode on any product page for an estimate specific to your area.",
            },
            {
                q: "How do I track my order?",
                a: "Every shipped order gets a Delhivery tracking number. Open My Orders to see live checkpoint-by-checkpoint progress, or use the Delhivery tracking link on the order.",
            },
            {
                q: "What are the shipping charges?",
                a: "Calculated at checkout from your pincode where courier rates are available, or a flat rate otherwise — and free above the threshold shown at checkout. The charge is always itemised before you pay.",
            },
        ],
    },
    {
        section: "Cancellations & replacements",
        items: [
            {
                q: "How do I cancel an order?",
                a: "From My Orders, while the order is still Placed or Processing. Cancellation is immediate, and any CoreCoins you redeemed are returned to your wallet at the same moment. Shipped orders can no longer be cancelled — you can refuse the delivery instead.",
            },
            {
                q: "My product arrived damaged. What do I do?",
                a: "Raise a replacement from My Orders within the replacement window shown on your delivered order, attaching clear photos of the damage. Approved replacements ship free — directly, after a doorstep pickup of the damaged unit, or as a single-visit exchange.",
            },
            {
                q: "Do you accept returns if I change my mind?",
                a: "Because supplements are consumable products, we can't accept opened products back for change-of-mind returns. Damaged, defective or incorrect deliveries are always covered by replacement.",
            },
        ],
    },
    {
        section: "CoreCoins",
        items: [
            {
                q: "What are CoreCoins?",
                a: "Our loyalty program. You earn coins on every delivered order and redeem them for a discount on future purchases — the redemption value is shown right at checkout.",
            },
            {
                q: "When are coins credited?",
                a: "After your order is delivered. If the order has a replacement window, coins credit automatically once that window closes, so your earnings and any replacement are settled together.",
            },
        ],
    },
    {
        section: "Products",
        items: [
            {
                q: "Are your products safe?",
                a: "Our products are manufactured to food-safety standards and sold as dietary supplements. They are not medicines and are not intended to diagnose, treat, cure or prevent any disease. Always read the label, follow the recommended usage, and consult a healthcare professional if you are pregnant, nursing, on medication or have a medical condition.",
            },
            {
                q: "Where do I find ingredient details?",
                a: "Every product page lists the key ingredients with per-serving amounts, usage directions, and safety information — the same details printed on the label.",
            },
        ],
    },
];

/** One expandable FAQ row. */
function FaqItem({ q, a, open, onToggle }) {
    return (
        <div className="border-b border-[#E8E4DE] last:border-b-0">
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="w-full flex items-center justify-between gap-4 py-4 text-left">
                <span className="text-sm font-semibold text-stone-800">{q}</span>
                <svg className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {open && <p className="pb-4 pr-8 text-sm leading-relaxed text-stone-600">{a}</p>}
        </div>
    );
}

export default function FAQPage() {
    const [openId, setOpenId] = useState(null);

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.flatMap((s) => s.items).map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
    };

    return (
        <div className="mx-auto max-w-3xl">
            <SEO
                title="FAQ"
                description="Answers about ordering, payment, shipping, cancellations, replacements and CoreCoins at Core Atoms."
                canonical="/faq"
            />
            <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

            <div className="mb-10">
                <p className="section-label">Help center</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900" style={{ textWrap: "balance" }}>
                    Frequently asked questions
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                    Can't find your answer? Head to the{" "}
                    <Link to="/contact" className="text-[#1e3a5f] underline underline-offset-2">Contact page</Link>.
                </p>
            </div>

            <div className="space-y-6">
                {FAQS.map((group) => (
                    <section key={group.section} className="rounded-2xl border border-[#E8E4DE] bg-white px-6 py-2">
                        <h2 className="section-label pt-4 pb-1">{group.section}</h2>
                        {group.items.map((f) => {
                            const id = `${group.section}::${f.q}`;
                            return (
                                <FaqItem key={id} q={f.q} a={f.a}
                                    open={openId === id}
                                    onToggle={() => setOpenId(openId === id ? null : id)} />
                            );
                        })}
                    </section>
                ))}
            </div>
        </div>
    );
}
