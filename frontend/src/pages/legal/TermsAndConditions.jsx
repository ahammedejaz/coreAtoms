/**
 * TermsAndConditions.jsx — Terms of use for the Core Atoms storefront.
 *
 * The clauses describe how the store actually behaves (server-verified
 * pricing, cancellation while an order is placed/processing, replacement
 * window after delivery) rather than boilerplate that promises features we
 * don't have. Business identity comes from `store_info` in app_settings.
 *
 * @module pages/legal/TermsAndConditions
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "./LegalPage";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../../services/storeInfo";

export default function TermsAndConditions() {
    const [info, setInfo] = useState(EMPTY_STORE_INFO);
    useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);

    const entity = info.legalName || "Core Atoms";

    return (
        <LegalPage
            title="Terms & Conditions"
            updated="31 August 2026"
            seoDescription="The terms that govern purchases from the Core Atoms store: ordering, pricing, payments, cancellations and replacements."
            canonical="/terms"
        >
            <LegalSection title="1. Who we are">
                <p>
                    This website is operated by {entity} ("we", "us"). By placing an order on this
                    site you agree to these terms and to our{" "}
                    <Link to="/privacy" className="text-[#1e3a5f] underline underline-offset-2">Privacy Policy</Link>,{" "}
                    <Link to="/shipping-policy" className="text-[#1e3a5f] underline underline-offset-2">Shipping Policy</Link> and{" "}
                    <Link to="/refund-policy" className="text-[#1e3a5f] underline underline-offset-2">Cancellation, Refund &amp; Replacement Policy</Link>.
                </p>
            </LegalSection>

            <LegalSection title="2. Products and health disclaimer">
                <p>
                    We sell nutraceutical and dietary supplement products. These products are not
                    medicines: they are <strong>not intended to diagnose, treat, cure or prevent any
                    disease</strong>. Always read the label, do not exceed the recommended daily usage,
                    and consult a qualified healthcare professional before use if you are pregnant,
                    nursing, taking medication or have a medical condition. Supplements are not a
                    substitute for a varied diet and healthy lifestyle.
                </p>
                <p>
                    Product images are for illustration; packaging you receive may vary as batches and
                    label revisions change.
                </p>
            </LegalSection>

            <LegalSection title="3. Orders and pricing">
                <p>
                    All prices are shown in Indian Rupees. Applicable GST and shipping charges are
                    itemised at checkout before you pay. Every order total — item prices, GST,
                    shipping, coupon discounts and CoreCoins redemption — is independently verified on
                    our servers when the order is placed; if the total displayed to you cannot be
                    verified, the order is rejected rather than charged incorrectly.
                </p>
                <p>
                    An order is accepted when it appears in <em>My Orders</em> with the status
                    "Placed". We may refuse or cancel an order for suspected fraud, pricing errors, or
                    stock unavailability; if payment was collected for a cancelled order it is
                    refunded in full.
                </p>
            </LegalSection>

            <LegalSection title="4. Payments">
                <p>
                    We accept online payment through Razorpay (cards, UPI, netbanking and wallets) and
                    Cash on Delivery where available. We never see or store your card details — online
                    payments are processed entirely by Razorpay. For Cash on Delivery, the exact order
                    total shown at checkout is the amount collected at your door.
                </p>
            </LegalSection>

            <LegalSection title="5. Cancellations and replacements">
                <p>
                    You can cancel an order yourself from <em>My Orders</em> at any time while it is
                    still in the "Placed" or "Processing" state. Once an order has been shipped it can
                    no longer be cancelled, but delivered products that arrive damaged or defective
                    can be raised for replacement within the replacement window shown on your order.
                    The full rules are in the{" "}
                    <Link to="/refund-policy" className="text-[#1e3a5f] underline underline-offset-2">Cancellation, Refund &amp; Replacement Policy</Link>.
                </p>
            </LegalSection>

            <LegalSection title="6. CoreCoins and coupons">
                <p>
                    CoreCoins are a loyalty benefit, earned on delivered orders and redeemable against
                    future purchases at the rate shown at checkout. They have no cash value, cannot be
                    transferred, and coins redeemed on an order are returned to your wallet if that
                    order is cancelled. Coupon codes are subject to their own validity window and
                    eligibility conditions, which are enforced at the time the order is placed.
                </p>
            </LegalSection>

            <LegalSection title="7. Your account">
                <p>
                    You are responsible for keeping your account credentials confidential and for all
                    activity under your account. We may suspend accounts used fraudulently or in
                    breach of these terms.
                </p>
            </LegalSection>

            <LegalSection title="8. Liability">
                <p>
                    To the maximum extent permitted by law, our liability for any claim arising out of
                    an order is limited to the amount you paid for that order. Nothing in these terms
                    limits rights that cannot be limited under the Consumer Protection Act, 2019.
                </p>
            </LegalSection>

            <LegalSection title="9. Governing law and grievances">
                <p>
                    These terms are governed by the laws of India. Complaints and grievances are
                    handled as described on our{" "}
                    <Link to="/contact" className="text-[#1e3a5f] underline underline-offset-2">Contact page</Link>,
                    which lists our grievance contact as required by the Consumer Protection
                    (E-Commerce) Rules, 2020.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
