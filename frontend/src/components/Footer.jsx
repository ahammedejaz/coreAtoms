import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#E8E4DE] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 md:grid-cols-4">

          {/* Brand */}
          <div className="md:col-span-2 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#1e3a5f] grid place-items-center shadow-sm">
                <span className="text-sm font-bold text-white tracking-wider">CA</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-900">Core Atoms</div>
                <div className="text-xs text-stone-400 tracking-wide">Premium Nutraceuticals</div>
              </div>
            </div>

            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              Clean formulas, structured stacks, and a premium experience — from checkout to delivery. Built for daily consistency.
            </p>

            <div className="flex items-center gap-2.5">
              {[
                { href: "https://www.instagram.com/core_atoms/", label: "Instagram", icon: <><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M16 11.37a4 4 0 1 1-7.88 1.26A4 4 0 0 1 16 11.37Z"/><path d="M17.5 6.5h.01"/></> },
                { href: "/", label: "X", icon: <><path d="M4 4l16 16"/><path d="M20 4L4 20"/></> },
                { href: "/", label: "YouTube", icon: <><path d="M10 15l5-3-5-3v6Z"/><path d="M21.5 7.5a3.2 3.2 0 0 0-2.25-2.25C17.5 5 12 5 12 5s-5.5 0-7.25.25A3.2 3.2 0 0 0 2.5 7.5 33 33 0 0 0 2.25 12c0 1.5.08 3 .25 4.5a3.2 3.2 0 0 0 2.25 2.25C6.5 19 12 19 12 19s5.5 0 7.25-.25a3.2 3.2 0 0 0 2.25-2.25c.17-1.5.25-3 .25-4.5s-.08-3-.25-4.5Z"/></> },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E4DE] bg-white text-stone-500 hover:text-[#1e3a5f] hover:border-[#1e3a5f]/30 transition">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                </a>
              ))}
            </div>
          </div>

          {/* Shop links */}
          <div className="space-y-4">
            <div className="section-label">Shop</div>
            <ul className="space-y-2.5">
              {[
                { label: "All Products", to: "/shop" },
                { label: "My Orders", to: "/orders" },
                { label: "Cart", to: "/cart" },
              ].map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div className="space-y-4">
            <div className="section-label">Company</div>
            <ul className="space-y-2.5">
              {[
                { label: "About", href: "https://atomslifecare.com/about" },
                { label: "Brand", href: "https://atomslifecare.com/brands" },
                { label: "Contact", href: "https://atomslifecare.com/contact" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#E8E4DE] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-stone-400">© {year} Core Atoms. All rights reserved.</p>
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
