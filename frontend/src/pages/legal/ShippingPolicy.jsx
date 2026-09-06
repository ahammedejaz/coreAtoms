/**
 * ShippingPolicy.jsx — How orders are shipped and delivered.
 *
 * The text lives in the `page_legal_shipping` content key (Admin → Site content) and is
 * rendered by `LegalDocument`; the defaults in `content/siteContent.js`
 * describe how the store actually behaves rather than boilerplate.
 *
 * @module pages/legal/ShippingPolicy
 */
import LegalDocument from "./LegalDocument";

export default function ShippingPolicy() {
    return <LegalDocument contentKey="page_legal_shipping" canonical="/shipping-policy" />;
}
