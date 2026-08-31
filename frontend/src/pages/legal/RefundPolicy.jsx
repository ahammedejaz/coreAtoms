/**
 * RefundPolicy.jsx — Cancellation, refund and replacement rules.
 *
 * These clauses mirror the enforced behavior: `cancel_order` accepts orders
 * in 'placed'/'processing', restores stock and refunds redeemed CoreCoins;
 * replacements are raised from My Orders within the configured window after
 * delivery with photo evidence. Keep this page in sync if those rules change.
 *
 * @module pages/legal/RefundPolicy
 */
import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "./LegalPage";

export default function RefundPolicy() {
    return (
        <LegalPage
            title="Cancellation, Refund & Replacement Policy"
            updated="31 August 2026"
            seoDescription="When Core Atoms orders can be cancelled, how refunds are processed, and how damaged products are replaced."
            canonical="/refund-policy"
        >
            <LegalSection title="Cancelling an order">
                <p>
                    You can cancel an order yourself — no phone call needed — from{" "}
                    <Link to="/orders" className="text-[#1e3a5f] underline underline-offset-2">My Orders</Link>{" "}
                    at any time while it is in the <strong>"Placed"</strong> or{" "}
                    <strong>"Processing"</strong> state. Cancellation is immediate: stock is released,
                    and any CoreCoins you redeemed on the order are returned to your wallet at the
                    same moment.
                </p>
                <p>
                    Once an order status moves to "Shipped" it is with the courier and can no longer
                    be cancelled from the site. If you no longer want a shipped order, you may refuse
                    the delivery; once it returns to us we will process a refund of the product amount.
                </p>
            </LegalSection>

            <LegalSection title="Refunds">
                <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Prepaid orders</strong> — refunds are issued to the original payment method through Razorpay, typically within 5–7 business days of the cancellation or return being confirmed. Your bank may take additional time to post it.</li>
                    <li><strong>Cash on Delivery orders</strong> — if cancelled before delivery, no money has changed hands and there is nothing to refund. For a refused or returned COD delivery, any refund due is settled to your bank account after we receive the shipment back.</li>
                    <li><strong>CoreCoins</strong> — coins redeemed on a cancelled order are re-credited automatically and in full.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Replacements for damaged or defective products">
                <p>
                    Because these are consumable supplement products, we do not accept opened products
                    back for change-of-mind returns. What we do stand behind is the condition the
                    product reaches you in:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                    <li>If your order arrives <strong>damaged, defective, or incorrect</strong>, raise a replacement from <Link to="/orders" className="text-[#1e3a5f] underline underline-offset-2">My Orders</Link> within the replacement window shown on your delivered order.</li>
                    <li>Attach clear photos of the damage — they are what our team reviews.</li>
                    <li>Approved replacements are shipped free of charge. Depending on the case, we may ship the replacement directly, arrange a doorstep pickup of the damaged product first, or exchange both in a single courier visit.</li>
                </ul>
                <p>
                    The replacement window and each request's live status are always visible on the
                    order itself.
                </p>
            </LegalSection>

            <LegalSection title="What is not covered">
                <ul className="list-disc pl-5 space-y-1.5">
                    <li>Change of mind after the product has been opened or used.</li>
                    <li>Damage caused by improper storage after delivery.</li>
                    <li>Requests raised after the replacement window on the order has closed.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Questions or disputes">
                <p>
                    If you believe a refund or replacement was handled incorrectly, contact us via the{" "}
                    <Link to="/contact" className="text-[#1e3a5f] underline underline-offset-2">Contact page</Link>.
                    Grievances are acknowledged and resolved within the timelines set by the Consumer
                    Protection (E-Commerce) Rules, 2020.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
