import { Link } from "react-router-dom";
export default function Footer() {
  const year = new Date().getFullYear();

  const links = {
    Shop: [
      { label: "All Products", href: "/shop" },
      { label: "Track Order", href: "/orders" },
      { label: "Cart", href: "/cart" },
    ],
    Company: [
      { label: "About", href: "https://atomslifecare.com/about" },
      { label: "Brand", href: "https://atomslifecare.com/brands" },
      { label: "Contact", href: "https://atomslifecare.com/contact" },
    ],
  };

  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white/70 backdrop-blur shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.15)]">
      {/* Top */}
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-neutral-200 shadow-sm grid place-items-center">
                <span className="text-sm font-semibold text-neutral-900">CA</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Core Atoms</div>
                <div className="text-xs text-neutral-500">Premium nutraceuticals, built for daily consistency.</div>
              </div>
            </div>

            <p className="text-sm text-neutral-600 leading-relaxed">
              Clean formulas, structured stacks, and a premium experience — from checkout to delivery.
            </p>

            {/* Social */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/core_atoms/"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:shadow transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <path d="M16 11.37a4 4 0 1 1-7.88 1.26A4 4 0 0 1 16 11.37Z" />
                  <path d="M17.5 6.5h.01" />
                </svg>
              </a>

              <a
                href="/"
                aria-label="X"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:shadow transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l16 16" />
                  <path d="M20 4L4 20" />
                </svg>
              </a>

              <a
                href="/"
                aria-label="YouTube"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:shadow transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15l5-3-5-3v6Z" />
                  <path d="M21.5 7.5a3.2 3.2 0 0 0-2.25-2.25C17.5 5 12 5 12 5s-5.5 0-7.25.25A3.2 3.2 0 0 0 2.5 7.5 33 33 0 0 0 2.25 12c0 1.5.08 3 .25 4.5a3.2 3.2 0 0 0 2.25 2.25C6.5 19 12 19 12 19s5.5 0 7.25-.25a3.2 3.2 0 0 0 2.25-2.25c.17-1.5.25-3 .25-4.5s-.08-3-.25-4.5Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([title, items]) => (
            <div key={title} className="space-y-3">
              <div className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
                {title}
              </div>
              <ul className="space-y-2">
                {items.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.href}
                      className="text-sm text-neutral-700 hover:text-neutral-950 hover:underline underline-offset-4 transition"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-10 h-px w-full bg-neutral-200" />

        {/* Bottom */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-neutral-500">
            © {year} Core Atoms. All rights reserved.
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-400" />
              Built with React + Tailwind
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="text-neutral-500">Made for India (COD available)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
