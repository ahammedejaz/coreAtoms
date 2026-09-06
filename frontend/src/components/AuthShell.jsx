/**
 * AuthShell.jsx — Split layout shared by Login, Forgot password and Reset
 * password: a photographic navy panel on the left, the form on the right.
 *
 * The panel shows the photograph saved as `page_account.panelImage`, or the
 * first home hero photograph when none is set, under a navy scrim with the
 * logo, an eyebrow, the heading arriving word by word, three numbered points
 * and a footnote. Every word comes from Admin → Site content → Account
 * pages. On phones the panel is a short band above the form that keeps the
 * photograph and the heading.
 *
 * @param {{ title: string, subtitle?: string, children: React.ReactNode }} props
 * @module components/AuthShell
 */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "../services/supabase/client";
import { useSiteContent } from "../services/siteContent";
import { useSiteLogo } from "../services/siteLogo";
import MaskWords from "./fx/MaskWords";

let heroCache = null;

/** The first home hero photograph, read once per page load. Resolves to null when there is none. */
async function fetchFirstHeroImage() {
  if (heroCache !== null) return heroCache;
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "homepage_hero_images").maybeSingle();
    const first = Array.isArray(data?.value) ? data.value[0] : null;
    heroCache = typeof first === "string"
      ? { url: first, position: "50% 50%" }
      : first?.url ? { url: first.url, position: first.position || "50% 50%" } : false;
  } catch {
    heroCache = false;
  }
  return heroCache;
}

export default function AuthShell({ title, subtitle, children }) {
  const account = useSiteContent("page_account");
  const logo = useSiteLogo();
  const points = (account.panelPoints || []).filter(Boolean).slice(0, 3);
  const [fallback, setFallback] = useState(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (account.panelImage) return undefined;
    let on = true;
    fetchFirstHeroImage().then((v) => { if (on) setFallback(v || null); });
    return () => { on = false; };
  }, [account.panelImage]);

  const photo = account.panelImage ? { url: account.panelImage, position: "50% 50%" } : fallback;
  const showPhoto = Boolean(photo?.url) && !broken;

  return (
    <div className="grid overflow-hidden rounded-[28px] bg-white shadow-frame ring-1 ring-line lg:min-h-[680px] lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="field-navy grain relative flex min-h-[260px] flex-col justify-between overflow-hidden p-7 sm:min-h-[320px] sm:p-10 lg:p-12">
        {showPhoto && (
          <>
            <div className="hero-slide is-active -z-[1]" aria-hidden="true">
              <img src={photo.url} alt="" style={{ objectPosition: photo.position }} decoding="async" onError={() => setBroken(true)} />
            </div>
            <div className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(8,19,42,0.42)_0%,rgba(8,19,42,0.5)_40%,rgba(8,19,42,0.95)_100%)]" aria-hidden="true" />
          </>
        )}

        <div className="relative z-[2] flex items-center justify-between gap-4">
          <img src={logo} alt="Core Atoms" className="h-6 w-auto brightness-0 invert sm:h-7" />
          {account.panelEyebrow && (
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur-sm">
              {account.panelEyebrow}
            </span>
          )}
        </div>

        <div className="relative z-[2] mt-12 lg:mt-0">
          <p className="max-w-[16ch] font-display text-[1.75rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.9rem]">
            <MaskWords text={account.panelHeading} />
          </p>
          {points.length > 0 && (
            <ol className="animate-rise mt-9 hidden border-t border-white/12 lg:block [animation-delay:500ms]">
              {points.map((t, i) => (
                <li key={t} className="flex items-center gap-4 border-b border-white/12 py-3.5 text-[14.5px] text-white/85">
                  <span className="w-6 shrink-0 font-display text-[12px] font-semibold tabular-nums text-amber">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">{t}</span>
                  <Check className="h-3.5 w-3.5 shrink-0 text-amber" strokeWidth={2.5} aria-hidden="true" />
                </li>
              ))}
            </ol>
          )}
          {account.panelFootnote && (
            <p className="animate-rise mt-6 hidden text-xs text-white/50 lg:block [animation-delay:700ms]">{account.panelFootnote}</p>
          )}
        </div>
      </aside>

      <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
        <div className="mx-auto w-full max-w-[380px]">
          <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[2.25rem]">{title}</h1>
          {subtitle && <p className="mt-2.5 text-[14.5px] leading-relaxed text-stone-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
