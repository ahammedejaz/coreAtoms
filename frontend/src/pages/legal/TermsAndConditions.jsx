/**
 * TermsAndConditions.jsx — Terms of use for the Core Atoms storefront.
 *
 * The text lives in the `page_legal_terms` content key (Admin → Site content) and is
 * rendered by `LegalDocument`; the defaults in `content/siteContent.js`
 * describe how the store actually behaves rather than boilerplate.
 *
 * @module pages/legal/TermsAndConditions
 */
import LegalDocument from "./LegalDocument";

export default function TermsAndConditions() {
    return <LegalDocument contentKey="page_legal_terms" canonical="/terms" />;
}
