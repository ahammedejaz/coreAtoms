/**
 * AnnouncementBar.jsx — Thin navy strip above the header.
 *
 * Carries the three facts a first-time visitor decides on: the free-shipping
 * threshold (from `free_shipping_min`), Cash on Delivery (from `cod_enabled`)
 * and lab testing. Desktop shows all three; phones rotate through them one
 * at a time so the strip stays a single line.
 *
 * @module components/AnnouncementBar
 */
import { useEffect, useMemo, useState } from "react";
import { fetchPricingSettings, EMPTY_PRICING } from "../services/settings";
import { money } from "../utils/format";

const ROTATE_MS = 4200;

export default function AnnouncementBar() {
  const [pricing, setPricing] = useState(EMPTY_PRICING);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let on = true;
    fetchPricingSettings().then((p) => { if (on) setPricing(p); });
    return () => { on = false; };
  }, []);

  const messages = useMemo(() => {
    const list = [];
    if (pricing.freeShippingMin > 0) list.push(`Free shipping on orders over ${money(pricing.freeShippingMin)}`);
    if (pricing.codEnabled) list.push("Cash on Delivery across India");
    list.push("Every batch third-party lab tested");
    return list;
  }, [pricing]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="bg-navy-950 text-white/85 text-[12.5px] font-medium tracking-tight">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 h-9 flex items-center justify-center">
        {/* Desktop: all facts, hairline separated */}
        <ul className="hidden sm:flex items-center">
          {messages.map((m, i) => (
            <li key={m} className={`flex items-center gap-2 ${i > 0 ? "ml-6 pl-6 border-l border-white/15" : ""}`}>
              {m}
            </li>
          ))}
        </ul>
        {/* Phone: one fact at a time */}
        <div className="sm:hidden relative h-full w-full overflow-hidden" aria-live="polite">
          {messages.map((m, i) => (
            <span
              key={m}
              className={`absolute inset-0 flex items-center justify-center gap-2 transition-[opacity,translate] duration-500 ease-out-strong ${i === index ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              aria-hidden={i !== index}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
