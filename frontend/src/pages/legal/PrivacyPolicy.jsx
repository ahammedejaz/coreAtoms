/**
 * PrivacyPolicy.jsx — What data the store collects and why.
 *
 * The text lives in the `page_legal_privacy` content key (Admin → Site content) and is
 * rendered by `LegalDocument`; the defaults in `content/siteContent.js`
 * describe how the store actually behaves rather than boilerplate.
 *
 * @module pages/legal/PrivacyPolicy
 */
import LegalDocument from "./LegalDocument";

export default function PrivacyPolicy() {
    return <LegalDocument contentKey="page_legal_privacy" canonical="/privacy" />;
}
