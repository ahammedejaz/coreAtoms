/**
 * AuthShell.jsx — Split layout shared by Login, Forgot password and Reset
 * password: a navy brand panel on the left, the form on the right. On
 * phones the panel collapses to a short band above the form. On desktop the
 * range's lead jar, lifted off its photograph, stands in the panel's lower
 * corner and floats slowly.
 *
 * @param {{ title: string, subtitle?: string, children: React.ReactNode }} props
 * @module components/AuthShell
 */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Cutout from "./Cutout";
import { fetchProductsCached } from "../services/products";
import { useSiteContent } from "../services/siteContent";

export default function AuthShell({ title, subtitle, children }) {
  const account = useSiteContent("page_account");
  const points = (account.panelPoints || []).filter(Boolean).slice(0, 3);
  const [leadProduct, setLeadProduct] = useState(null);
  useEffect(() => {
    let on = true;
    fetchProductsCached().then((list) => { if (on) setLeadProduct(list?.find((p) => p.image) || null); }).catch(() => {});
    return () => { on = false; };
  }, []);

  return (
    <div className="grid overflow-hidden rounded-[28px] border border-line bg-white lg:min-h-[640px] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="field-navy grain relative flex flex-col justify-between overflow-hidden p-7 sm:p-10 lg:p-12">
        {leadProduct?.image && (
          <div className="pointer-events-none absolute -bottom-[4%] -right-[8%] z-[1] hidden w-[66%] lg:block" aria-hidden="true">
            <div className="hero-float">
              <Cutout src={leadProduct.image} className="hero-jar-enter w-full -rotate-6" />
            </div>
          </div>
        )}
        <div className="relative z-[2]">
          <img src="/logo.png" alt="Core Atoms" className="h-6 w-auto brightness-0 invert sm:h-7" />
          <p className="mt-6 font-display text-2xl font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-3xl lg:mt-10 lg:text-4xl">
            {account.panelHeading}
          </p>
          <ul className="mt-8 hidden space-y-3 lg:block">
            {points.map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14.5px] text-white/80">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
                  <Check className="h-3 w-3 text-amber" strokeWidth={3} aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-[2] mt-10 hidden text-xs text-white/50 lg:block">{account.panelFootnote}</p>
      </aside>

      <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
