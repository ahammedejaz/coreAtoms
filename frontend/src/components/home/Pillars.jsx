/**
 * Pillars.jsx — The four admin-authored promises (`homepage_pillars`) on one
 * white panel that overlaps the foot of the hero, so the first viewport ends
 * on something the visitor can hold on to.
 *
 * @param {{ pillars: Array<{title:string, desc:string}> }} props
 * @module components/home/Pillars
 */
import HintIcon from "../HintIcon";

export default function Pillars({ pillars }) {
  const items = (pillars || []).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-5 sm:px-6 lg:-mt-20">
      <ul className="animate-rise grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-white shadow-lift-lg [animation-delay:900ms] lg:grid-cols-4">
        {items.map((p, i) => (
          <li
            key={`${p.title}-${i}`}
            className={`flex gap-3.5 p-5 sm:p-6 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-line" : ""}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-brand">
              <HintIcon hint={p.title} className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold leading-snug text-ink">{p.title}</p>
              <p className="mt-1 hidden text-[13px] leading-snug text-stone-500 sm:block">{p.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
