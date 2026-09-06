/**
 * Navbar.jsx — Sticky header: logo, global search with live suggestions, a
 * category row, account links and the cart trigger.
 *
 * - Global product search submits to `/shop?q=<term>`; while typing it shows
 *   up to six matching products from the cached catalogue (arrow keys, Enter
 *   and Escape all work). The header owns search — Shop only reads the URL.
 * - The category row (desktop) / drawer section (mobile) comes from
 *   `app_settings.homepage_categories`, falling back to `DEFAULT_HOME_CATEGORIES`.
 * - The cart button opens the slide-over `CartDrawer`; the count bumps on add.
 * - The order-limit warning from `CartContext.lastAction` shows as a toast.
 * - Mobile menu: full-width sheet under the header, links reveal with a
 *   short stagger; `inert` while closed.
 *
 * @module components/Navbar
 */
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingBag,
  House,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  LogIn,
  ArrowRight,
  ImageOff,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useCartDrawer } from "../context/CartDrawerContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase/client";
import { DEFAULT_HOME_CATEGORIES } from "../services/homepage";
import { fetchProductsCached } from "../services/products";
import { money } from "../utils/format";
import HintIcon from "./HintIcon";
import { useScrollLock } from "./fx/SmoothScroll";

const navLinkClass = ({ isActive }) =>
  `-mx-1 px-1 py-2 text-sm transition-colors duration-150 ${isActive ? "text-ink font-semibold" : "text-stone-600 hover:text-ink"}`;

const mobileNavLinkActiveClass = "bg-brand-soft text-brand font-semibold";
const mobileNavLinkInactiveClass = "text-stone-700 hover:bg-bone hover:text-ink";
const mobileNavLinkClass = ({ isActive }) =>
  `block px-4 py-3 rounded-2xl text-[15px] font-medium transition-colors duration-150 ${isActive ? mobileNavLinkActiveClass : mobileNavLinkInactiveClass}`;

/** Bolds the matched substring inside a suggestion label. */
function Highlight({ text, q }) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SuggestionImage({ src }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div className="grid h-full w-full place-items-center text-stone-300"><ImageOff className="h-4 w-4" strokeWidth={1.5} /></div>;
  return <img src={src} alt="" className="product-img h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />;
}

/**
 * Search input with live suggestions. Keyed by `location.key` from the
 * parent so it resets to the URL's `q` on every navigation.
 */
function SearchForm({ id, className, initialQuery, onSubmit }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [catalogue, setCatalogue] = useState(null);
  const q = term.trim().toLowerCase();

  useEffect(() => {
    if (q.length < 2 || catalogue !== null) return;
    let on = true;
    fetchProductsCached().then((list) => { if (on) setCatalogue(list); }).catch(() => { if (on) setCatalogue([]); });
    return () => { on = false; };
  }, [q, catalogue]);

  const matches = useMemo(() => {
    if (q.length < 2 || !catalogue) return [];
    return catalogue
      .filter((p) => p.isActive !== false && (p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [q, catalogue]);

  const showList = open && q.length >= 2;
  const listId = `${id}-listbox`;

  const pick = (p) => {
    setOpen(false);
    navigate(`/product/${p.id}`);
  };

  const onKeyDown = (e) => {
    if (!showList) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(matches.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Enter" && active >= 0 && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => { e.preventDefault(); setOpen(false); onSubmit(term.trim()); }}
    >
      <label htmlFor={id} className="sr-only">Search products</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.75} aria-hidden="true" />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search formulas, e.g. magnesium"
          className="h-11 w-full rounded-full border border-line-strong bg-bone/70 pl-11 pr-4 text-sm text-ink placeholder:text-stone-400 outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-brand focus:bg-white focus:shadow-[0_0_0_4px_rgba(30,58,95,0.08)]"
        />
        <button type="submit" className="sr-only">Search</button>
      </div>

      {showList && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-panel border border-line bg-white shadow-lift-lg">
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {matches.length === 0 ? (
              <li className="px-4 py-3.5 text-sm text-stone-500">{catalogue ? `Nothing named "${term.trim()}" yet.` : "Searching…"}</li>
            ) : matches.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${i === active ? "bg-bone" : ""}`}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-bone"><SuggestionImage src={p.image} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink"><Highlight text={p.name} q={q} /></p>
                  {p.category && <p className="truncate text-xs text-stone-500">{p.category}</p>}
                </div>
                <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink">{money(p.price)}</span>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-bone"
          >
            See all results for "{term.trim()}"
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </form>
  );
}

export default function Navbar() {
  const { totalItems, lastAction, maxItems } = useCart();
  const { open: openDrawer } = useCartDrawer();
  const { isAuthenticated, user, isAdmin, signOut } = useAuth();
  const homePath = isAdmin ? "/admin" : "/";
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [categories, setCategories] = useState(DEFAULT_HOME_CATEGORIES);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && menuOpen) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Load site logo + category row content
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["site_logo", "homepage_categories"])
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((row) => { map[row.key] = row.value; });
        if (map.site_logo && typeof map.site_logo === "string" && map.site_logo.startsWith("http")) {
          setLogoUrl(map.site_logo);
        }
        setCategories(
          Array.isArray(map.homepage_categories) && map.homepage_categories.length > 0
            ? map.homepage_categories
            : DEFAULT_HOME_CATEGORIES
        );
      });
  }, []);

  // Wraps the message in a fresh object per cart event so a repeated identical
  // limit warning still registers.
  const toastSignal = useMemo(() => {
    if (lastAction?.type !== "limit") return null;
    return { source: lastAction, text: lastAction.message || `Max ${maxItems} items per order` };
  }, [lastAction, maxItems]);

  useEffect(() => {
    if (!toastSignal) return;
    setToast(toastSignal.text);
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toastSignal]);

  // Freeze the page behind the open menu (through Lenis when it runs).
  useScrollLock(menuOpen);

  // A global search always lands on /shop with a fresh q — other filters reset,
  // since search looks across the whole catalogue. `replace` while already on
  // /shop so retyping a search doesn't pile up history.
  const submitSearch = (q) => {
    navigate(
      { pathname: "/shop", search: q ? `?q=${encodeURIComponent(q)}` : "" },
      { replace: location.pathname === "/shop" }
    );
  };

  const isShopPath = location.pathname === "/shop";
  const activeCategoryParam = searchParams.get("category");
  const catClass = (active) =>
    `relative inline-flex h-full items-center whitespace-nowrap text-[13.5px] transition-colors duration-150 ${active
      ? "font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-ink"
      : "text-stone-600 hover:text-ink"}`;

  const cartButton = (extra = "") => (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Open cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
      className={`relative inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-white pl-3.5 pr-2.5 text-sm font-semibold text-ink transition-[scale,border-color,background-color] duration-200 ease-out-strong hover:border-ink hover:bg-bone active:scale-[0.96] ${extra}`}
    >
      <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
      <span className="hidden lg:inline">Cart</span>
      {/* Keyed on the count so the badge re-runs its pop each time the cart changes. */}
      <span key={totalItems} className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-colors duration-200 ${totalItems > 0 ? "animate-[pop_320ms_var(--ease-out-strong)] bg-ink text-white" : "bg-bone text-stone-500"}`}>
        {totalItems}
      </span>
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="flex h-16 items-center gap-4">

            {/* Logo */}
            <Link to={homePath} className="flex shrink-0 items-center" aria-label="Core Atoms home">
              <img src={logoUrl || "/logo.png"} alt="Core Atoms" className="h-8 w-auto max-w-[150px] object-contain" />
            </Link>

            {/* Desktop search */}
            {!isAdmin && (
              <SearchForm
                key={`desktop-${location.key}`}
                id="navbar-search-desktop"
                className="hidden md:block flex-1 max-w-xl"
                initialQuery={initialQuery}
                onSubmit={submitSearch}
              />
            )}

            {/* Desktop nav */}
            <nav className="ml-auto hidden items-center gap-5 md:flex" aria-label="Account">
              {isAuthenticated ? (
                <>
                  {!isAdmin && <NavLink to="/orders" className={navLinkClass}>My orders</NavLink>}
                  {isAdmin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
                  <button onClick={signOut} className="text-sm text-stone-600 transition-colors duration-150 hover:text-ink">Log out</button>
                  <span className="hidden max-w-[140px] truncate text-xs text-stone-400 lg:inline">{user?.email}</span>
                </>
              ) : (
                <NavLink to="/login" className={navLinkClass}>Log in</NavLink>
              )}
              {!isAdmin && cartButton()}
            </nav>

            {/* Mobile right-side: cart + hamburger */}
            <div className="ml-auto flex items-center gap-2 md:hidden">
              {!isAdmin && cartButton()}
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors duration-150 hover:bg-bone"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
              >
                <span aria-hidden="true" className={`absolute left-1/2 top-1/2 h-[1.5px] w-4 -translate-x-1/2 rounded-full bg-current transition-transform duration-200 ease-out-strong ${menuOpen ? "rotate-45" : "-translate-y-[4px]"}`} />
                <span aria-hidden="true" className={`absolute left-1/2 top-1/2 h-[1.5px] w-4 -translate-x-1/2 rounded-full bg-current transition-transform duration-200 ease-out-strong ${menuOpen ? "-rotate-45" : "translate-y-[4px]"}`} />
              </button>
            </div>
          </div>

          {/* Mobile search row */}
          {!isAdmin && (
            <SearchForm
              key={`mobile-${location.key}`}
              id="navbar-search-mobile"
              className="pb-3 md:hidden"
              initialQuery={initialQuery}
              onSubmit={submitSearch}
            />
          )}
        </div>

        {/* Desktop category row */}
        {!isAdmin && (
          <div className="hidden border-t border-line md:block">
            <nav aria-label="Shop by category" className="mx-auto flex h-10 max-w-6xl items-center gap-7 overflow-x-auto px-5 no-scrollbar sm:px-6">
              <Link to="/shop" className={catClass(isShopPath && !activeCategoryParam)}>All products</Link>
              {categories.map((cat) => (
                <Link
                  key={cat.category}
                  to={`/shop?category=${encodeURIComponent(cat.category)}`}
                  className={catClass(isShopPath && activeCategoryParam === cat.category)}
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Mobile menu sheet */}
        <div
          id="mobile-menu"
          inert={!menuOpen}
          data-lenis-prevent
          className={`absolute inset-x-0 top-full max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-line bg-white shadow-lift-lg transition-[translate,opacity,visibility] ease-out-strong md:hidden ${menuOpen ? "visible translate-y-0 opacity-100 duration-250" : "invisible -translate-y-2 opacity-0 duration-150"}`}
        >
          <nav className="space-y-0.5 px-4 py-3" aria-label="Mobile">
            {(() => {
              let i = 0;
              const reveal = () => ({
                className: `transition-[translate,opacity] duration-300 ease-out-strong ${menuOpen ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"}`,
                style: { transitionDelay: menuOpen ? `${40 + i++ * 25}ms` : "0ms" },
              });
              return (
                <>
                  {!isAdmin && (
                    <>
                      <div {...reveal()}>
                        <NavLink to="/" className={mobileNavLinkClass}>
                          <span className="flex items-center gap-3"><House className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />Home</span>
                        </NavLink>
                      </div>
                      <div {...reveal()}>
                        <NavLink to="/shop" end className={mobileNavLinkClass}>
                          <span className="flex items-center gap-3"><ShoppingBag className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />All products</span>
                        </NavLink>
                      </div>
                      <div {...reveal()} >
                        <p className="px-4 pb-1 pt-4 text-xs font-semibold text-stone-400">Shop by need</p>
                      </div>
                      {categories.map((cat) => {
                        const isActive = isShopPath && activeCategoryParam === cat.category;
                        return (
                          <div key={cat.category} {...reveal()}>
                            <Link
                              to={`/shop?category=${encodeURIComponent(cat.category)}`}
                              className={`block rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors duration-150 ${isActive ? mobileNavLinkActiveClass : mobileNavLinkInactiveClass}`}
                              aria-current={isActive ? "page" : undefined}
                            >
                              <span className="flex items-center gap-3">
                                <HintIcon hint={cat.label} className="h-4 w-4 text-stone-400" strokeWidth={1.75} />
                                {cat.label}
                              </span>
                            </Link>
                          </div>
                        );
                      })}
                      <div {...reveal()}><div className="my-2 border-t border-line" /></div>
                    </>
                  )}

                  {isAuthenticated ? (
                    <>
                      {!isAdmin && (
                        <div {...reveal()}>
                          <NavLink to="/orders" className={mobileNavLinkClass}>
                            <span className="flex items-center gap-3"><ClipboardList className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />My orders</span>
                          </NavLink>
                        </div>
                      )}
                      {isAdmin && (
                        <div {...reveal()}>
                          <NavLink to="/admin" className={mobileNavLinkClass}>
                            <span className="flex items-center gap-3"><LayoutDashboard className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />Admin dashboard</span>
                          </NavLink>
                        </div>
                      )}
                      <div {...reveal()}>
                        <div className="mt-1 flex items-center justify-between rounded-2xl bg-bone px-4 py-2.5">
                          <div className="max-w-[220px] truncate text-xs text-stone-500">{user?.email}</div>
                          {isAdmin && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Admin</span>}
                        </div>
                      </div>
                      <div {...reveal()}>
                        <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium text-red-600 transition-colors duration-150 hover:bg-red-50">
                          <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Log out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div {...reveal()}>
                      <NavLink to="/login" className={mobileNavLinkClass}>
                        <span className="flex items-center gap-3"><LogIn className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />Log in</span>
                      </NavLink>
                    </div>
                  )}
                </>
              );
            })()}
          </nav>
        </div>
      </header>

      {/* Order-limit toast */}
      {toast && (
        <div className="pointer-events-none fixed right-4 top-24 z-[80]">
          <div className="animate-toast-in rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-lift-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Mobile menu scrim — sits behind the sticky header. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-navy-950/30 transition-opacity duration-200 md:hidden ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMenuOpen(false)}
      />
    </>
  );
}
