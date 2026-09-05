/**
 * LegalDocument.jsx — One policy page, read from Site content.
 *
 * Terms, Privacy, Shipping and Refunds are the same document shape: a
 * title, a last-updated line and titled sections of rich text (RichText
 * grammar: paragraphs, "-" bullets, **bold**, [label](/path) links). The
 * body may use {legalName}, {supportEmail} and {supportPhone}, filled from
 * the `store_info` setting at render time. Each page passes its content key
 * and canonical path.
 *
 * @param {{ contentKey: string, canonical: string }} props
 * @module pages/legal/LegalDocument
 */
import { useEffect, useState } from "react";
import LegalPage, { LegalSection } from "./LegalPage";
import RichText from "../../components/RichText";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../../services/storeInfo";
import { useSiteContent } from "../../services/siteContent";

export default function LegalDocument({ contentKey, canonical }) {
    const [info, setInfo] = useState(EMPTY_STORE_INFO);
    useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);
    const doc = useSiteContent(contentKey);
    const vars = {
        legalName: info.legalName || "Core Atoms",
        supportEmail: info.supportEmail || "the support address on the Contact page",
        supportPhone: info.supportPhone || "",
    };
    const sections = (doc.sections || []).filter((s) => s?.title && s?.body);

    return (
        <LegalPage title={doc.title} updated={doc.updated} seoDescription={doc.seoDescription} canonical={canonical}>
            {sections.map((s) => (
                <LegalSection key={s.title} title={s.title}>
                    <RichText text={s.body} vars={vars} variant="legal" />
                </LegalSection>
            ))}
        </LegalPage>
    );
}
