/**
 * Contact.jsx — Contact and grievance information.
 *
 * The Consumer Protection (E-Commerce) Rules, 2020 require the seller's
 * identity and a grievance contact to be published on the selling site.
 * The paragraphs come from the `page_contact` content key (Admin → Site
 * content → Contact) and may use {legalName}, {supportEmail}, {supportPhone}
 * and {grievanceOfficer}; the details themselves come from the `store_info`
 * setting (Admin → Settings → Store information). Fields that are not
 * configured yet are simply omitted.
 *
 * @module pages/legal/Contact
 */
import { useEffect, useState } from "react";
import LegalPage, { LegalSection, InfoRow } from "./LegalPage";
import RichText from "../../components/RichText";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../../services/storeInfo";
import { useSiteContent } from "../../services/siteContent";

export default function Contact() {
    const [info, setInfo] = useState(EMPTY_STORE_INFO);
    useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);
    const copy = useSiteContent("page_contact");

    const hasAnyContact = info.supportEmail || info.supportPhone || info.address;
    const vars = {
        legalName: info.legalName || "Core Atoms",
        supportEmail: info.supportEmail || "the support address",
        supportPhone: info.supportPhone || "",
        grievanceOfficer: info.grievanceOfficer || "our grievance officer",
    };

    return (
        <LegalPage
            title={copy.title}
            seoDescription="How to reach the Core Atoms team for order support, questions and grievances."
            canonical="/contact"
        >
            <LegalSection title="Order support">
                <RichText text={copy.supportText} vars={vars} variant="legal" />
            </LegalSection>

            <LegalSection title={copy.reachHeading}>
                {hasAnyContact ? (
                    <div className="space-y-2.5">
                        {info.legalName && <InfoRow label="Business">{info.legalName}</InfoRow>}
                        {info.supportEmail && (
                            <InfoRow label="Email">
                                <a className="text-[#1e3a5f] underline underline-offset-2" href={`mailto:${info.supportEmail}`}>{info.supportEmail}</a>
                            </InfoRow>
                        )}
                        {info.supportPhone && (
                            <InfoRow label="Phone">
                                <a className="text-[#1e3a5f] underline underline-offset-2" href={`tel:${info.supportPhone.replace(/\s+/g, "")}`}>{info.supportPhone}</a>
                            </InfoRow>
                        )}
                        {info.address && <InfoRow label="Address">{info.address}</InfoRow>}
                        {info.fssaiLicense && <InfoRow label="FSSAI Lic. No.">{info.fssaiLicense}</InfoRow>}
                    </div>
                ) : (
                    <RichText text={copy.fallbackText} vars={vars} variant="legal" />
                )}
            </LegalSection>

            <LegalSection title={copy.grievanceHeading}>
                <RichText text={copy.grievanceText} vars={vars} variant="legal" />
            </LegalSection>
        </LegalPage>
    );
}
