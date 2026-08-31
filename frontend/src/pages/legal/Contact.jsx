/**
 * Contact.jsx — Contact and grievance information.
 *
 * The Consumer Protection (E-Commerce) Rules, 2020 require the seller's
 * identity and a grievance contact to be published on the selling site.
 * Everything shown here comes from the `store_info` settings key
 * (Admin → Settings → Store information); fields that are not configured
 * yet are simply omitted.
 *
 * @module pages/legal/Contact
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalPage, { LegalSection, InfoRow } from "./LegalPage";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../../services/storeInfo";

export default function Contact() {
    const [info, setInfo] = useState(EMPTY_STORE_INFO);
    useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);

    const hasAnyContact = info.supportEmail || info.supportPhone || info.address;

    return (
        <LegalPage
            title="Contact Us"
            seoDescription="How to reach the Core Atoms team for order support, questions and grievances."
            canonical="/contact"
        >
            <LegalSection title="Order support">
                <p>
                    The fastest answers for order questions are on the site itself:{" "}
                    <Link to="/orders" className="text-[#1e3a5f] underline underline-offset-2">My Orders</Link>{" "}
                    shows live tracking for every shipment, lets you cancel eligible orders instantly,
                    and is where replacements for damaged products are raised. Common questions are
                    answered on the{" "}
                    <Link to="/faq" className="text-[#1e3a5f] underline underline-offset-2">FAQ page</Link>.
                </p>
            </LegalSection>

            <LegalSection title="Reach us">
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
                    <p>
                        You can also reach the team on Instagram{" "}
                        <a className="text-[#1e3a5f] underline underline-offset-2" href="https://www.instagram.com/core_atoms/" target="_blank" rel="noopener noreferrer">@core_atoms</a>.
                    </p>
                )}
            </LegalSection>

            <LegalSection title="Grievance redressal">
                <p>
                    In accordance with the Consumer Protection (E-Commerce) Rules, 2020, complaints
                    that are not resolved through regular support can be escalated to our grievance
                    contact{info.grievanceOfficer ? <>, <strong>{info.grievanceOfficer}</strong>,</> : null}{" "}
                    {info.supportEmail
                        ? <>at <a className="text-[#1e3a5f] underline underline-offset-2" href={`mailto:${info.supportEmail}`}>{info.supportEmail}</a> </>
                        : null}
                    with "Grievance" in the subject line. Grievances are acknowledged within 48 hours
                    and resolved within one month of receipt.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
