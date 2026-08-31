/**
 * Footer.jsx — Site-wide footer.
 *
 * Displays brand info, social links, shop/help/policy links, contact and
 * FSSAI details from the `store_info` setting, and the supplement disclaimer
 * required for nutraceutical products. All social icons use inline SVG for
 * zero dependencies.
 *
 * The policy links exist for more than navigation: payment-gateway site
 * verification and the Consumer Protection (E-Commerce) Rules, 2020 both
 * require them to be reachable from the storefront.
 *
 * @module components/Footer
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../services/storeInfo";

const SHOP_LINKS = [
  { label: "All Products", to: "/shop" },
  { label: "My Orders", to: "/orders" },
  { label: "Cart", to: "/cart" },
];

const HELP_LINKS = [
  { label: "FAQ", to: "/faq" },
  { label: "Contact Us", to: "/contact" },
  { label: "Track Order", to: "/orders" },
  { label: "About", href: "https://atomslifecare.com/about" },
];

const POLICY_LINKS = [
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Shipping Policy", to: "/shipping-policy" },
  { label: "Refunds & Replacements", to: "/refund-policy" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const [info, setInfo] = useState(EMPTY_STORE_INFO);
  useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);

  return (
    <footer className="mt-auto bg-gradient-to-b from-[#FAFAF8] via-white to-[#f5f3ef] relative">
      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1e3a5f]/10 to-transparent" />
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#1e3a5f]/8 to-transparent blur-sm" />
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-5">

          {/* Brand */}
          <div className="md:col-span-2 space-y-5">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Core Atoms" className="h-8 w-auto max-w-[140px] object-contain" />
            </div>

            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              Clean formulas, structured stacks, and a premium experience — from checkout to delivery. Built for daily consistency.
            </p>

            <div className="flex items-center gap-2.5">
              {[
                { href: "https://www.instagram.com/core_atoms/", label: "Instagram", icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M16 11.37a4 4 0 1 1-7.88 1.26A4 4 0 0 1 16 11.37Z" /><path d="M17.5 6.5h.01" /></> },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E4DE] bg-white text-stone-500 hover:text-[#1e3a5f] hover:border-[#1e3a5f]/30 transition">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                </a>
              ))}
            </div>

            {/* Contact details — rendered only once the admin fills them in */}
            {(info.supportEmail || info.supportPhone || info.address) && (
              <address className="not-italic text-xs text-stone-400 leading-relaxed space-y-0.5">
                {info.legalName && <div className="font-medium text-stone-500">{info.legalName}</div>}
                {info.address && <div>{info.address}</div>}
                {info.supportEmail && (
                  <div><a href={`mailto:${info.supportEmail}`} className="hover:text-stone-600 transition-colors">{info.supportEmail}</a></div>
                )}
                {info.supportPhone && (
                  <div><a href={`tel:${info.supportPhone.replace(/\s+/g, "")}`} className="hover:text-stone-600 transition-colors">{info.supportPhone}</a></div>
                )}
              </address>
            )}
          </div>

          {/* Shop links */}
          <div className="space-y-4">
            <div className="section-label">Shop</div>
            <ul className="space-y-2.5">
              {SHOP_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help links */}
          <div className="space-y-4">
            <div className="section-label">Help</div>
            <ul className="space-y-2.5">
              {HELP_LINKS.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</a>
                  ) : (
                    <Link to={l.to} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Policy links */}
          <div className="space-y-4">
            <div className="section-label">Policies</div>
            <ul className="space-y-2.5">
              {POLICY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Supplement disclaimer — required presentation for nutraceuticals */}
        <div className="mt-12 pt-6 border-t border-[#E8E4DE]">
          <p className="text-[11px] leading-relaxed text-stone-400 max-w-3xl">
            Products sold on this site are dietary supplements, not medicines, and are not intended to
            diagnose, treat, cure or prevent any disease. Always read the label and do not exceed the
            recommended usage. Consult a healthcare professional before use if you are pregnant,
            nursing, taking medication or have a medical condition. Supplements are not a substitute
            for a varied diet.
            {info.fssaiLicense && <> FSSAI Lic. No. {info.fssaiLicense}.</>}
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-[#E8E4DE] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-stone-400">© {year} {info.legalName || "Core Atoms"}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />COD available pan-India</span>
            <span>•</span>
            <span>Clean label guarantee</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
