/**
 * Cart.jsx — Shopping cart page.
 *
 * Line items as hairline rows with quantity steppers, an order summary with
 * the free-shipping meter, and a "Checkout" CTA. Unauthenticated visitors
 * are sent to `/login` with a redirect back to checkout.
 *
 * Pricing settings come from the cached `fetchPricingSettings()` so the
 * page, the drawer and the announcement bar always agree.
 *
 * @module pages/Cart
 */
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ImageOff, Lock, MapPin, Minus, PackageCheck, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import SEO from "../components/SEO";
import ConfirmDialog from "../components/ConfirmDialog";
import RevealText from "../components/fx/RevealText";
import Magnetic from "../components/fx/Magnetic";
import Cutout from "../components/Cutout";
import { useSiteContent } from "../services/siteContent";
import { fetchProductsCached } from "../services/products";
import { AnimatePresence, motion } from "motion/react";
import { fetchPricingSettings, EMPTY_PRICING } from "../services/settings";
import { useEffect, useState } from "react";

import { money } from "../utils/format";

const TRUST = [
  { icon: Lock, label: "Secure checkout" },
  { icon: PackageCheck, label: "Quality packing" },
  { icon: MapPin, label: "Ships across India" },
];

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { items, totalItems, subtotal, updateQty, removeItem, clear } = useCart();
  const [pricing, setPricing] = useState(EMPTY_PRICING);
  const [confirmClear, setConfirmClear] = useState(false);
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [leadProduct, setLeadProduct] = useState(null);
  const copy = useSiteContent("page_cart");

  // The empty state shows the range's lead jar; a failed read simply leaves it out.
  useEffect(() => {
    let on = true;
    fetchProductsCached().then((list) => { if (on) setLeadProduct(list?.find((p) => p.image) || null); }).catch(() => {});
    return () => { on = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPricingSettings().then((p) => { if (!cancelled) setPricing(p); });
    return () => { cancelled = true; };
  }, []);

  const { shippingBase, freeShippingMin, gstPercent } = pricing;
  const sub = Number(subtotal || 0);
  const qualifiesFreeShipping = freeShippingMin > 0 && sub >= freeShippingMin;
  // If admin flat rate = 0, shipping will be calculated by Delhivery at checkout
  const shippingTBD = shippingBase === 0 && !qualifiesFreeShipping;
  const shipping = qualifiesFreeShipping ? 0 : shippingBase;
  const gstAmount = gstPercent > 0 ? Math.round((sub * gstPercent) / 100) : 0;
  const total = sub + shipping + gstAmount;
  const amountToFreeShipping = freeShippingMin > 0 && !qualifiesFreeShipping ? freeShippingMin - sub : 0;
  const progress = freeShippingMin > 0 ? Math.min(100, Math.round((sub / freeShippingMin) * 100)) : 0;

  const empty = !items || items.length === 0;

  return (
    <div>
      <SEO title="Cart | Core Atoms" description="Review your cart and proceed to checkout." />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <RevealText as="h1" text={copy.title} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
          {!empty && <span className="text-lg font-medium text-stone-400 tabular-nums">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>}
        </div>
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Continue shopping
        </Link>
      </div>

      {empty ? (
        <div className="border-t border-line py-16 text-center lg:py-20">
          <div className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72">
            <span className="absolute inset-[8%] rounded-full bg-bone" aria-hidden="true" />
            {leadProduct?.image ? (
              <div className="hero-float relative flex h-full w-full items-center justify-center">
                <Cutout
                  src={leadProduct.image}
                  alt=""
                  className="hero-jar-enter max-h-[92%] w-auto max-w-full object-contain"
                  fallback={(
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-brand shadow-lift">
                      <ShoppingBag className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  )}
                />
              </div>
            ) : (
              <span className="relative grid h-full w-full place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-brand shadow-lift">
                  <ShoppingBag className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                </span>
              </span>
            )}
          </div>
          <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">{copy.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-stone-500">{copy.emptyText}</p>
          <Link to="/shop" className="btn-primary btn-lg mt-8">
            Browse the range
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">

          {/* Lines */}
          <div>
            <ul className="border-y border-line">
              <AnimatePresence initial={false}>
              {items.map((item) => {
                const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
                const broken = !item.image || brokenImages.has(item.id);
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="flex gap-4 border-b border-line py-5 last:border-b-0 sm:gap-6"
                  >
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-bone sm:h-28 sm:w-28">
                      {broken ? (
                        <div className="grid h-full w-full place-items-center text-stone-300" aria-hidden="true">
                          <ImageOff className="h-6 w-6" strokeWidth={1.25} />
                        </div>
                      ) : (
                        <img src={item.image} alt="" className="product-img h-full w-full object-cover" loading="lazy"
                          onError={() => setBrokenImages((prev) => new Set(prev).add(item.id))} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          {item.category && <p className="text-[11.5px] font-medium text-stone-500">{item.category}</p>}
                          <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{item.name}</h3>
                          <p className="mt-1 text-[13px] text-stone-500 tabular-nums">{money(item.unitPrice)} each</p>
                        </div>
                        <p className="shrink-0 font-display text-lg font-semibold tabular-nums text-ink">{money(lineTotal)}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-line-strong bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Number(item.qty) - 1;
                              if (next < 1) {
                                removeItem(item.id);
                                showToast(`${item.name} removed from cart`, "info");
                              } else {
                                updateQty(item.id, next);
                              }
                            }}
                            className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-bone hover:text-ink"
                            aria-label={Number(item.qty) <= 1 ? `Remove ${item.name}` : "Decrease quantity"}
                          >
                            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                          </button>
                          <span className="w-9 text-center text-sm font-semibold tabular-nums text-ink">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-bone hover:text-ink"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition-colors hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </ul>
            <button type="button" onClick={() => setConfirmClear(true)} className="mt-4 text-xs font-medium text-stone-500 transition-colors hover:text-red-600">
              Clear the cart
            </button>
          </div>

          {/* Summary */}
          <aside>
            <div className="panel sticky top-32 p-6">
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Order summary</h2>

              {freeShippingMin > 0 && (
                <div className="mt-5">
                  <p className="text-[13px] text-stone-700">
                    {qualifiesFreeShipping
                      ? <span className="font-semibold text-emerald-700">Free shipping unlocked</span>
                      : <>Add <span className="font-semibold text-ink tabular-nums">{money(amountToFreeShipping)}</span> more for free shipping</>}
                  </p>
                  <div className={`meter mt-2 ${qualifiesFreeShipping ? "is-complete" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progress to free shipping">
                    <span style={{ "--meter": progress / 100 }} />
                  </div>
                </div>
              )}

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-600">Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</dt>
                  <dd className="font-semibold tabular-nums text-ink">{money(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Shipping</dt>
                  <dd className="tabular-nums">
                    {qualifiesFreeShipping ? (
                      <span className="font-semibold text-emerald-700">Free</span>
                    ) : shippingTBD ? (
                      <span className="text-xs text-stone-500">Calculated at checkout</span>
                    ) : (
                      <span className="font-semibold text-ink">{money(shipping)}</span>
                    )}
                  </dd>
                </div>
                {gstPercent > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-stone-600">GST ({gstPercent}%)</dt>
                    <dd className="font-semibold tabular-nums text-ink">{money(gstAmount)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-xs text-stone-500">{copy.summaryNote}</p>

              <div className="my-5 border-t border-line" />

              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-ink">Total</span>
                <div className="text-right">
                  <span className="font-display text-2xl font-semibold tabular-nums text-ink">{money(total)}</span>
                  {shippingTBD && <p className="text-[11px] text-stone-500">plus shipping</p>}
                </div>
              </div>

              <Magnetic className="mt-6 w-full" strength={0.18}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      showToast("Please sign in to checkout", "info");
                      navigate("/login?redirect=%2Fcheckout");
                    } else {
                      navigate("/checkout");
                    }
                  }}
                  className="btn-primary btn-lg w-full"
                >
                  Checkout
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Magnetic>

              <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {TRUST.map(({ icon: Icon, label }, i) => ({ icon: Icon, label: copy.trust?.[i] || label })).map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex items-center gap-1.5 text-[11.5px] text-stone-500">
                    <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear your cart?"
          message={`This removes all ${totalItems} item${totalItems !== 1 ? "s" : ""} from your cart. This can't be undone.`}
          confirmLabel="Clear cart"
          cancelLabel="Keep them"
          onConfirm={() => { clear(); setConfirmClear(false); showToast("Cart cleared", "info"); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
