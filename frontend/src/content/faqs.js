/**
 * faqs.js — The customer FAQ, grouped by topic. Shared by the FAQ page (all
 * groups, with FAQPage schema markup) and the home page preview (a handful
 * of questions a first-time visitor asks before buying).
 *
 * @module content/faqs
 */
export const FAQS = [
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

/** Questions the home page surfaces, in this order. */
const HOME_PICKS = [
    "Are your products safe?",
    "Where do I find ingredient details?",
    "Is Cash on Delivery available?",
    "How long does delivery take?",
    "My product arrived damaged. What do I do?",
];

export const HOME_FAQS = HOME_PICKS
    .map((q) => FAQS.flatMap((s) => s.items).find((f) => f.q === q))
    .filter(Boolean);
