/**
 * PrivacyPolicy.jsx — What data the store collects and why.
 *
 * Written against what the app actually does: Supabase auth + profiles,
 * orders and addresses, Razorpay payment processing, Delhivery shipping,
 * localStorage cart/profile caches, and no third-party analytics or ad
 * trackers. Keep this page honest if that changes.
 *
 * @module pages/legal/PrivacyPolicy
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "./LegalPage";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../../services/storeInfo";

export default function PrivacyPolicy() {
    const [info, setInfo] = useState(EMPTY_STORE_INFO);
    useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);

    return (
        <LegalPage
            title="Privacy Policy"
            updated="31 August 2026"
            seoDescription="What personal data Core Atoms collects, why, who it is shared with, and the choices you have."
            canonical="/privacy"
        >
            <LegalSection title="What we collect">
                <p>When you create an account and shop with us, we collect:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Account details</strong> — your name, email address and password (stored as a secure hash; we never see the password itself).</li>
                    <li><strong>Order details</strong> — the products you buy, order totals, payment method, and order status history.</li>
                    <li><strong>Delivery details</strong> — the recipient name, phone number and shipping address you enter at checkout.</li>
                    <li><strong>Reviews</strong> — ratings and review text you choose to publish, shown with the display name you provide.</li>
                </ul>
                <p>
                    We do not collect your card, UPI or banking details — online payments are processed
                    directly by Razorpay, and only a payment reference reaches us.
                </p>
            </LegalSection>

            <LegalSection title="How we use it">
                <ul className="list-disc pl-5 space-y-1.5">
                    <li>To process, deliver and support your orders.</li>
                    <li>To operate your account, order history, replacements and CoreCoins wallet.</li>
                    <li>To send transactional messages about your orders (confirmations, status updates).</li>
                    <li>To prevent fraud and abuse — for example, verifying order totals server-side and rate-limiting suspicious traffic.</li>
                </ul>
                <p>We do not sell your personal data, and we do not use third-party advertising trackers on this site.</p>
            </LegalSection>

            <LegalSection title="Who we share it with">
                <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Razorpay</strong> — to process online payments (they receive the amount and payment identifiers; they show you their own privacy terms at payment time).</li>
                    <li><strong>Delhivery</strong> — our courier partner receives the recipient name, phone, address and, for Cash on Delivery, the amount to collect, so your order can be delivered.</li>
                    <li><strong>Supabase</strong> — our infrastructure provider, which hosts our database and authentication.</li>
                </ul>
                <p>Each partner receives only what it needs to perform its role.</p>
            </LegalSection>

            <LegalSection title="Cookies and device storage">
                <p>
                    We use your browser's local storage for functional purposes only: keeping you
                    signed in, remembering your cart between visits, and caching your profile so pages
                    load faster. Clearing your browser's site data removes these. We do not set
                    third-party advertising cookies.
                </p>
            </LegalSection>

            <LegalSection title="Retention and your choices">
                <p>
                    Order records are retained as required for accounting and tax law. You can update
                    your saved addresses and profile from your account. To request correction or
                    deletion of your personal data, contact us using the details on the{" "}
                    <Link to="/contact" className="text-[#1e3a5f] underline underline-offset-2">Contact page</Link>
                    {info.supportEmail ? <> or email <a className="text-[#1e3a5f] underline underline-offset-2" href={`mailto:${info.supportEmail}`}>{info.supportEmail}</a></> : null}.
                    We respond to grievances as required by the Information Technology Act, 2000 and
                    the Consumer Protection (E-Commerce) Rules, 2020.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
