/**
 * ShippingPolicy.jsx — How orders are shipped and delivered.
 *
 * Reflects the real pipeline: Delhivery as the courier, pincode
 * serviceability check at checkout, pincode-based or flat shipping rate,
 * free-shipping threshold from settings, and live tracking from My Orders.
 *
 * @module pages/legal/ShippingPolicy
 */
import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "./LegalPage";

export default function ShippingPolicy() {
    return (
        <LegalPage
            title="Shipping & Delivery Policy"
            updated="31 August 2026"
            seoDescription="How Core Atoms ships orders across India: serviceability, charges, timelines and tracking."
            canonical="/shipping-policy"
        >
            <LegalSection title="Where we deliver">
                <p>
                    We ship across India through our courier partner <strong>Delhivery</strong>. Enter
                    your pincode on any product page or at checkout to confirm serviceability and see
                    the delivery estimate for your area before you order. Both prepaid and Cash on
                    Delivery are supported on serviceable pincodes (COD availability can vary by
                    location).
                </p>
            </LegalSection>

            <LegalSection title="Shipping charges">
                <p>
                    The shipping charge for your order is calculated at checkout — based on your
                    pincode where courier rates are available, or a flat rate otherwise — and is always
                    itemised before you pay. Orders above the free-shipping threshold shown at
                    checkout ship free. There are no hidden charges: for Cash on Delivery, the amount
                    collected at your door is exactly the order total shown at checkout.
                </p>
            </LegalSection>

            <LegalSection title="Dispatch and delivery timelines">
                <ul className="list-disc pl-5 space-y-1.5">
                    <li>Orders are typically dispatched within 1–2 business days of being placed.</li>
                    <li>Metro cities usually receive orders in 3–5 business days after dispatch.</li>
                    <li>Other serviceable locations usually take 5–7 business days; remote or out-of-delivery-area pincodes can take 7–10.</li>
                </ul>
                <p>
                    These are estimates, not guarantees — courier delays, weather and regional
                    disruptions can extend them. The tracking page always has the current status.
                </p>
            </LegalSection>

            <LegalSection title="Tracking your order">
                <p>
                    As soon as your order is handed to the courier, a tracking number (AWB) is
                    assigned. You can follow the shipment live from{" "}
                    <Link to="/orders" className="text-[#1e3a5f] underline underline-offset-2">My Orders</Link>,
                    which shows checkpoint-by-checkpoint progress, or on Delhivery's own tracking page
                    via the link on your order.
                </p>
            </LegalSection>

            <LegalSection title="If a delivery fails">
                <p>
                    The courier attempts delivery multiple times and will usually contact the phone
                    number on the order. If a shipment is returned to us undelivered, we will contact
                    you to reship it or cancel and refund the order. If your package arrives damaged,
                    please refuse the delivery if possible, or raise a replacement from{" "}
                    <Link to="/orders" className="text-[#1e3a5f] underline underline-offset-2">My Orders</Link>{" "}
                    with photos — see the{" "}
                    <Link to="/refund-policy" className="text-[#1e3a5f] underline underline-offset-2">Cancellation, Refund &amp; Replacement Policy</Link>.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
