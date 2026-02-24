/**
 * Checkout.jsx — Complete checkout flow with saved addresses + COD order placement.
 *
 * Loads the user's saved addresses from Supabase, allows picking one or entering
 * a new address, validates form fields (Indian phone + 6-digit pincode), and
 * places the order via the `place_order_cod` RPC.
 *
 * @module pages/Checkout
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";
import useDocumentTitle from "../hooks/useDocumentTitle";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

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
  useDocumentTitle("Checkout | Core Atoms");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, totalItems, clear } = useCart();

  // Saved addresses from Supabase
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null); // null = new address form

  // The address form (used for both new address and editing)
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);

  // Order state
  const [placed, setPlaced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorToast, setErrorToast] = useState("");

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
  };

  // Start a new blank address form
  const startNewAddress = () => {
    setSelectedAddressId(null);
    setForm(EMPTY_ADDRESS);
    setAddressSaved(false);
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
    if (error) { alert(error.message); return; }
    setAddressSaved(true);
    await loadAddresses();
    setSelectedAddressId(data.id);
  };

  // Delete a saved address
  const deleteAddress = async (id) => {
    if (!window.confirm("Remove this saved address?")) return;
    await supabase.from("addresses").delete().eq("id", id);
    if (selectedAddressId === id) {
      setSelectedAddressId(null);
      setForm(EMPTY_ADDRESS);
    }
    await loadAddresses();
  };

  // The active address used to place the order
  const activeAddress = form;
  const canPlace =
    !!user &&
    totalItems > 0 &&
    isValidAddress(activeAddress);

  const onPlaceOrder = async () => {
    if (!canPlace || loading) return;
    setLoading(true);
    try {
      // Cart ids for variant items are "productId_variantId" composites.
      // The RPC expects a pure product UUID + optional variant_id separately.
      const payloadItems = (items || []).map((x) => {
        const rawId = String(x.id);
        const parts = rawId.split("_");
        // UUID format: 8-4-4-4-12 chars = 36 chars total
        const isComposite = parts.length === 2 &&
          parts[0].length === 36 && parts[1].length === 36;
        return {
          product_id: isComposite ? parts[0] : rawId,
          variant_id: isComposite ? parts[1] : null,
          qty: Number(x.qty || 0),
          unit_price_inr: Number(x.unitPrice ?? x.price ?? 0),
        };
      });

      const { error } = await supabase.rpc("place_order_cod", {
        p_user_id: user.id,
        p_address: activeAddress,
        p_items: payloadItems,
      });

      if (error) throw error;
      setPlaced(true);
      setTimeout(() => { clear(); navigate("/orders"); }, 1400);
    } catch (e) {
      const msg = e?.message || "Unknown error";
      if (msg.toLowerCase().includes("insufficient")) {
        setErrorToast("⚠️ Some items are out of stock. Please reduce quantity and try again.");
        setTimeout(() => setErrorToast(""), 3500);
      } else {
        alert(`Order failed: ${msg}`);
      }
    } finally {
      setLoading(false);
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
      <div className="mb-8">
        <Link to="/cart" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Back to Cart</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">Checkout</h1>
        <p className="text-sm text-stone-500 mt-1">Cash on Delivery · India only</p>
      </div>

      {errorToast && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700">
          {errorToast}
        </div>
      )}

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
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteAddress(addr.id); }}
                    className="text-xs text-stone-300 hover:text-red-400 transition-colors shrink-0">✕</button>
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

            <button onClick={onPlaceOrder} disabled={!canPlace || loading}
              className="btn-primary w-full py-3 text-[14px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              {loading ? "Placing order…" : "Place order · COD"}
            </button>

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
