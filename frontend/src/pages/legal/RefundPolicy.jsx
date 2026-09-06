/**
 * RefundPolicy.jsx — Cancellation, refund and replacement rules.
 *
 * The text lives in the `page_legal_refund` content key (Admin → Site content) and is
 * rendered by `LegalDocument`; the defaults in `content/siteContent.js`
 * describe how the store actually behaves rather than boilerplate.
 *
 * @module pages/legal/RefundPolicy
 */
import LegalDocument from "./LegalDocument";

export default function RefundPolicy() {
    return <LegalDocument contentKey="page_legal_refund" canonical="/refund-policy" />;
}
