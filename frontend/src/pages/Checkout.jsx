/**
 * Checkout.jsx — Complete checkout flow with saved addresses + COD / Razorpay.
 *
 * Loads the user's saved addresses from Supabase, allows picking one or entering
 * a new address, validates form fields (Indian phone + 6-digit pincode), and
 * places the order via COD or Razorpay online payment.
 *
 * @module pages/Checkout
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { supabase } from "../services/supabase/client";
import { getRazorpayKeyId, openRazorpayCheckout } from "../services/razorpay";
import SEO from "../components/SEO";

import { money } from "../utils/format";

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

function isValidAddress(a) {
  return (
    a.fullName.trim() &&
    /^[6-9]\d{9}$/.test(a.phone.trim()) &&
    a.line1.trim() &&
    a.city.trim() &&
    a.state.trim() &&
    /^\d{6}$/.test(a.pincode.trim())
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, totalItems, clear } = useCart();
  const { showToast } = useToast();

  // Saved addresses from Supabase
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null); // null = new address form

  // The address form (used for both new address and editing)
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);

  // Confirmation state for address deletion (replaces window.confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Order state
  const [placed, setPlaced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);

  // Razorpay toggle (read from app_settings)
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);

  // COD toggle (read from app_settings, defaults to true)
  const [codAvailable, setCodAvailable] = useState(true);

  useEffect(() => {
    // Check if Razorpay is both enabled in admin AND key is configured
    supabase.from("app_settings").select("value")
      .eq("key", "razorpay_enabled").maybeSingle()
      .then(({ data }) => {
        const enabled = data?.value?.enabled === true;
        const hasKey = !!getRazorpayKeyId();
        setRazorpayAvailable(enabled && hasKey);
      });

    // Check if COD is enabled (defaults to true if setting doesn't exist)
    supabase.from("app_settings").select("value")
      .eq("key", "cod_enabled").maybeSingle()
      .then(({ data }) => {
        setCodAvailable(data?.value?.enabled !== false);
      });
  }, []);

  const shipping = 0;
  const total = Number(subtotal || 0) + shipping;

  // Load saved addresses from Supabase
  const loadAddresses = useCallback(async () => {
    if (!user?.id) return;
    setLoadingAddresses(true);
    const { data } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = data || [];
    setSavedAddresses(list);
    // Auto-select the most recent saved address if any
    if (list.length > 0 && selectedAddressId === null) {
      setSelectedAddressId(list[0].id);
      const a = list[0];
      setForm({
        fullName: a.full_name || "",
        phone: a.phone || "",
        line1: a.line1 || "",
        line2: a.line2 || "",
        city: a.city || "",
        state: a.state || "",
        pincode: a.pincode || "",
      });
    }
    setLoadingAddresses(false);
  }, [user?.id, selectedAddressId]);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  // When user selects a saved address, populate the form
  const selectSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setForm({
      fullName: addr.full_name || "",
      phone: addr.phone || "",
      line1: addr.line1 || "",
      line2: addr.line2 || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
    });
    setAddressSaved(false);
    setPendingDeleteId(null);
  };

  // Start a new blank address form
  const startNewAddress = () => {
    setSelectedAddressId(null);
    setForm(EMPTY_ADDRESS);
    setAddressSaved(false);
    setPendingDeleteId(null);
  };

  // Save current form as a new address in Supabase
  const saveAddress = async () => {
    if (!isValidAddress(form) || !user?.id) return;
    setSavingAddress(true);
    const payload = {
      user_id: user.id,
      full_name: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
    };
    const { data, error } = await supabase
      .from("addresses")
      .insert([payload])
      .select()
      .single();
    setSavingAddress(false);
    if (error) { showToast(error.message, "error"); return; }
    setAddressSaved(true);
    showToast("Address saved", "success");
    await loadAddresses();
    setSelectedAddressId(data.id);
  };

  // Delete a saved address (with inline confirmation instead of window.confirm)
  const confirmDeleteAddress = async (id) => {
    await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
    setPendingDeleteId(null);
    if (selectedAddressId === id) {
      setSelectedAddressId(null);
      setForm(EMPTY_ADDRESS);
    }
    showToast("Address removed", "info");
    await loadAddresses();
  };

  // The active address used to place the order
  const activeAddress = form;
  const canPlace =
    !!user &&
    totalItems > 0 &&
    isValidAddress(activeAddress);

  // Build the items payload (shared between COD and Razorpay)
  const buildPayloadItems = () => (items || []).map((x) => {
    const rawId = String(x.id);
    const parts = rawId.split("_");
    const isComposite = parts.length === 2 &&
      parts[0].length === 36 && parts[1].length === 36;
    return {
      product_id: isComposite ? parts[0] : rawId,
      variant_id: isComposite ? parts[1] : null,
      qty: Number(x.qty || 0),
      unit_price_inr: Number(x.unitPrice ?? x.price ?? 0),
    };
  });

  // ── COD Order ──
  const onPlaceOrder = async () => {
    if (!canPlace || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("place_order_cod", {
        p_user_id: user.id,
        p_address: activeAddress,
        p_items: buildPayloadItems(),
      });
      if (error) throw error;
      setPlaced(true);
      setTimeout(() => { clear(); navigate("/orders"); }, 1400);
    } catch (e) {
      const msg = e?.message || "Unknown error";
      if (msg.toLowerCase().includes("insufficient")) {
        showToast("Some items are out of stock. Please reduce quantity and try again.", "warning", 4000);
      } else {
        showToast(`Order failed: ${msg}`, "error", 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Razorpay Online Payment ──
  const onPayOnline = async () => {
    if (!canPlace || payingOnline) return;
    setPayingOnline(true);
    try {
      const amountPaise = Math.round(total * 100);

      // 1. Create Razorpay order via Edge Function
      const { data: rzpOrder, error: rzpErr } = await supabase.functions.invoke(
        "create-razorpay-order",
        { body: { amount: amountPaise, receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}` } }
      );
      if (rzpErr) {
        // Try to read the actual error body from the Edge Function response
        let detail = rzpErr.message || "Failed to create payment order";
        if (rzpErr.context && typeof rzpErr.context.json === "function") {
          try {
            const errBody = await rzpErr.context.json();
            detail = errBody?.error || errBody?.message || detail;
          } catch (_) { /* ignore parse errors */ }
        }
        throw new Error(detail);
      }
      if (!rzpOrder?.id) throw new Error("Invalid payment order response");

      // 2. Open Razorpay Checkout popup
      await openRazorpayCheckout({
        razorpayOrderId: rzpOrder.id,
        amount: amountPaise,
        name: "Core Atoms",
        description: `Order — ${totalItems} item${totalItems > 1 ? "s" : ""}`,
        prefill: {
          name: activeAddress.fullName,
          email: user.email || "",
          contact: activeAddress.phone,
        },
        onSuccess: async (response) => {
          try {
            // 3. Verify payment + create order via Edge Function
            const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
              "verify-razorpay-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  user_id: user.id,
                  address: activeAddress,
                  items: buildPayloadItems(),
                },
              }
            );
            if (verifyErr) {
              let detail = verifyErr.message || "Payment verification failed";
              if (verifyErr.context && typeof verifyErr.context.json === "function") {
                try {
                  const errBody = await verifyErr.context.json();
                  detail = errBody?.error || errBody?.message || detail;
                } catch (_) { /* ignore parse errors */ }
              }
              throw new Error(detail);
            }
            setPlaced(true);
            setTimeout(() => { clear(); navigate("/orders"); }, 1400);
          } catch (vErr) {
            showToast(`Payment received but order failed: ${vErr.message}. Contact support.`, "error", 6000);
          } finally {
            setPayingOnline(false);
          }
        },
        onDismiss: () => {
          setPayingOnline(false);
          showToast("Payment cancelled", "info");
        },
      });
    } catch (e) {
      const msg = e?.message || "Unknown error";
      showToast(`Payment failed: ${msg}`, "error", 4000);
      setPayingOnline(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-12 text-center max-w-sm w-full">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full border-4 border-[#E8E4DE] border-t-[#1e3a5f] animate-spin" />
          <h2 className="text-xl font-semibold text-stone-900">Order placed!</h2>
          <p className="mt-2 text-sm text-stone-500">We're confirming your order and preparing it for dispatch.</p>
          <div className="mt-6 h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-[#1e3a5f] rounded-full animate-[coreatoms_progress_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="mt-4 text-xs text-stone-400">Redirecting to My Orders…</p>
        </div>
      </div>
    );
  }

  const inputCls = "w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition";

  return (
    <div>
      <SEO title="Checkout | Core Atoms" description="Complete your order with cash on delivery." noIndex />
      <div className="mb-8">
        <Link to="/cart" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Back to Cart</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">Checkout</h1>
        <p className="text-sm text-stone-500 mt-1">Cash on Delivery · India only</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── Address panel ── */}
        <div className="lg:col-span-3 space-y-5">
          <div className="card p-6">
            <h2 className="text-base font-semibold text-stone-900">Delivery Address</h2>
            <p className="text-xs text-stone-400 mt-1">Select a saved address or add a new one.</p>
          </div>

          {/* Saved addresses */}
          {loadingAddresses ? (
            <div className="card p-5 text-sm text-stone-400">Loading saved addresses…</div>
          ) : savedAddresses.length > 0 && (
            <div className="card p-5 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Saved</p>
              {savedAddresses.map((addr) => (
                <div key={addr.id} onClick={() => selectSavedAddress(addr)}
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${selectedAddressId === addr.id
                    ? "border-[#1e3a5f] bg-[#EFF6FF]"
                    : "border-[#E8E4DE] hover:border-stone-300"
                    }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedAddressId === addr.id ? "border-[#1e3a5f]" : "border-stone-300"
                    }`}>
                    {selectedAddressId === addr.id && <div className="h-2 w-2 rounded-full bg-[#1e3a5f]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{addr.full_name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}</p>
                    <p className="text-xs text-stone-500">{addr.phone}</p>
                  </div>
                  {/* Delete button with inline confirmation */}
                  {pendingDeleteId === addr.id ? (
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => confirmDeleteAddress(addr.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">Remove</button>
                      <button type="button" onClick={() => setPendingDeleteId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPendingDeleteId(addr.id); }}
                      className="text-xs text-stone-300 hover:text-red-400 transition-colors shrink-0">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={startNewAddress}
                className={`w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium transition-all ${selectedAddressId === null
                  ? "border-[#1e3a5f] text-[#1e3a5f] bg-[#EFF6FF]"
                  : "border-[#E8E4DE] text-stone-400 hover:border-stone-300 hover:text-stone-600"
                  }`}
              >
                + Add a new address
              </button>
            </div>
          )}

          {/* New address form */}
          {(selectedAddressId === null || savedAddresses.length === 0) && (
            <div className="card p-6 space-y-4">
              {savedAddresses.length > 0 && <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">New address</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">Full name *</label>
                  <input value={form.fullName} onChange={(e) => setForm(a => ({ ...a, fullName: e.target.value }))} placeholder="Your name" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">Phone (India) *</label>
                  <input value={form.phone} onChange={(e) => setForm(a => ({ ...a, phone: e.target.value }))} placeholder="10-digit mobile" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1.5">Address line 1 *</label>
                <input value={form.line1} onChange={(e) => setForm(a => ({ ...a, line1: e.target.value }))} placeholder="House / Flat, Street" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 block mb-1.5">Address line 2 (optional)</label>
                <input value={form.line2} onChange={(e) => setForm(a => ({ ...a, line2: e.target.value }))} placeholder="Landmark, Area" className={inputCls} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">City *</label>
                  <input value={form.city} onChange={(e) => setForm(a => ({ ...a, city: e.target.value }))} placeholder="City" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">State *</label>
                  <input value={form.state} onChange={(e) => setForm(a => ({ ...a, state: e.target.value }))} placeholder="State" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1.5">Pincode *</label>
                  <input value={form.pincode} onChange={(e) => setForm(a => ({ ...a, pincode: e.target.value }))} placeholder="6 digits" className={inputCls} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={saveAddress} disabled={!isValidAddress(form) || savingAddress || addressSaved}
                  className={`btn-ghost text-sm py-2 px-4 ${addressSaved ? "border-emerald-300 text-emerald-600" : ""}`}>
                  {savingAddress ? "Saving…" : addressSaved ? "Saved ✓" : "Save address"}
                </button>
                {addressSaved && <span className="text-xs text-emerald-600">Address saved for future orders</span>}
              </div>
            </div>
          )}

          {!canPlace && (form.fullName || form.line1) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Fill all required fields — name, valid 10-digit phone, address, city, state, 6-digit pincode.
            </div>
          )}
        </div>

        {/* ── Order summary ── */}
        <div className="lg:col-span-2">
          <div className="card p-6 sticky top-24">
            <h2 className="text-base font-semibold text-stone-900 mb-5">Order Summary</h2>
            <div className="space-y-3 text-sm">
              {(items || []).map((x) => (
                <div key={x.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 truncate">{x.name}</p>
                    <p className="text-xs text-stone-400">{money(x.unitPrice ?? x.price)} × {x.qty}</p>
                  </div>
                  <span className="font-semibold text-stone-900 shrink-0">{money((Number(x.unitPrice ?? x.price) || 0) * (Number(x.qty) || 0))}</span>
                </div>
              ))}
            </div>

            <div className="my-5 h-px bg-[#E8E4DE]" />

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-stone-600"><span>Subtotal</span><span className="font-semibold text-stone-900">{money(subtotal)}</span></div>
              <div className="flex justify-between text-stone-600"><span>Shipping</span><span className="font-semibold text-emerald-600">Free</span></div>
              <div className="flex justify-between text-base font-semibold text-stone-900 pt-1"><span>Total</span><span>{money(total)}</span></div>
            </div>

            <div className="space-y-3">
              {codAvailable && (
                <button onClick={onPlaceOrder} disabled={!canPlace || loading || payingOnline}
                  className="btn-primary w-full py-3 text-[14px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {loading ? "Placing order…" : "Place order · COD"}
                </button>
              )}

              {razorpayAvailable && (
                <button onClick={onPayOnline} disabled={!canPlace || loading || payingOnline}
                  className="w-full rounded-xl bg-[#2563EB] px-4 py-3 text-[14px] font-semibold text-white shadow-md hover:bg-[#1d4ed8] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {payingOnline ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Processing payment…
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      Pay now · Online
                    </>
                  )}
                </button>
              )}

              {!codAvailable && !razorpayAvailable && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-sm font-semibold text-amber-800">No payment methods available</p>
                  <p className="text-xs text-amber-600 mt-1">Please contact support or try again later.</p>
                </div>
              )}

              {razorpayAvailable && (
                <div className="text-center text-[11px] text-stone-400">Choose COD or pay securely online via Razorpay</div>
              )}
            </div>

            {!canPlace && !form.fullName && (
              <p className="mt-3 text-xs text-stone-400 text-center">Select or fill an address above to continue.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
              {["🔒 Secure checkout", "📦 Quality packing", "🇮🇳 India only"].map((t) => (
                <span key={t} className="text-[11px] text-stone-400">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
