/**
 * Footer.jsx — Site-wide footer.
 *
 * Brand column, three link columns, the contact and FSSAI details from the
 * `store_info` setting, and the supplement disclaimer nutraceutical products
 * must carry. The policy links are required to be reachable from the
 * storefront by payment-gateway verification and the Consumer Protection
 * (E-Commerce) Rules, 2020.
 *
 * @module components/Footer
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { fetchStoreInfo, EMPTY_STORE_INFO } from "../services/storeInfo";
import { useSiteContent } from "../services/siteContent";

const SHOP_LINKS = [
  { label: "All products", to: "/shop" },
  { label: "My orders", to: "/orders" },
  { label: "Cart", to: "/cart" },
];

const HELP_LINKS = [
  { label: "FAQ", to: "/faq" },
  { label: "Contact us", to: "/contact" },
  { label: "Track an order", to: "/orders" },
];

const POLICY_LINKS = [
  { label: "Terms & conditions", to: "/terms" },
  { label: "Privacy policy", to: "/privacy" },
  { label: "Shipping policy", to: "/shipping-policy" },
  { label: "Refunds & replacements", to: "/refund-policy" },
];

const linkClass = "text-[14px] text-stone-600 transition-colors hover:text-ink";

function Column({ title, links }) {
  return (
    <div>
      <p className="font-display text-[15px] font-semibold tracking-tight text-ink">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.href ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-1`}>
                {l.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-stone-400" strokeWidth={1.75} aria-hidden="true" />
              </a>
            ) : (
              <Link to={l.to} className={linkClass}>{l.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const [info, setInfo] = useState(EMPTY_STORE_INFO);
  useEffect(() => { let on = true; fetchStoreInfo().then((i) => { if (on) setInfo(i); }); return () => { on = false; }; }, []);
  const { footer } = useSiteContent("site_global");
  const helpLinks = footer.aboutLabel && footer.aboutUrl ? [...HELP_LINKS, { label: footer.aboutLabel, href: footer.aboutUrl }] : HELP_LINKS;

  return (
    <footer className="mt-auto border-t-2 border-ink bg-bone">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">

          {/* Brand */}
          <div>
            <img src="/logo.png" alt="Core Atoms" className="h-8 w-auto max-w-[150px] object-contain" />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-stone-600">{footer.tagline}</p>

            {footer.instagramHandle && footer.instagramUrl && (
            <a
              href={footer.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" /><path d="M16 11.37a4 4 0 1 1-7.88 1.26A4 4 0 0 1 16 11.37Z" /><path d="M17.5 6.5h.01" />
              </svg>
              {footer.instagramHandle}
            </a>
            )}

            {(info.supportEmail || info.supportPhone || info.address) && (
              <address className="mt-6 space-y-0.5 text-[13px] not-italic leading-relaxed text-stone-500">
                {info.legalName && <div className="font-medium text-stone-700">{info.legalName}</div>}
                {info.address && <div>{info.address}</div>}
                {info.supportEmail && <div><a href={`mailto:${info.supportEmail}`} className="transition-colors hover:text-ink">{info.supportEmail}</a></div>}
                {info.supportPhone && <div><a href={`tel:${info.supportPhone.replace(/\s+/g, "")}`} className="transition-colors hover:text-ink">{info.supportPhone}</a></div>}
              </address>
            )}
          </div>

          <Column title="Shop" links={SHOP_LINKS} />
          <Column title="Help" links={helpLinks} />
          <Column title="Policies" links={POLICY_LINKS} />
        </div>

        {/* Supplement disclaimer — required presentation for nutraceuticals */}
        <div className="mt-14 border-t border-line-strong pt-6">
          <p className="max-w-3xl text-[12px] leading-relaxed text-stone-500">
            {footer.disclaimer}
            {info.fssaiLicense && <> FSSAI Lic. No. {info.fssaiLicense}.</>}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line-strong pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {info.legalName || "Core Atoms"}. All rights reserved.</p>
          <p>{footer.madeIn}</p>
        </div>
      </div>
    </footer>
  );
}
