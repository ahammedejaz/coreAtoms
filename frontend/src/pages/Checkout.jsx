import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";

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
  }, [user?.id]);

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
      const payloadItems = (items || []).map((x) => ({
        product_id: String(x.id),
        qty: Number(x.qty || 0),
      }));

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
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full border-4 border-neutral-200 border-t-neutral-900 animate-spin" />
          <div className="text-2xl font-semibold text-neutral-950">Order placed 🎉</div>
          <div className="mt-2 text-sm text-neutral-600">We're confirming your order and preparing it for dispatch.</div>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full w-1/2 bg-neutral-900 animate-[coreatoms_progress_1.2s_ease-in-out_infinite]" />
          </div>
          <div className="mt-5 text-xs text-neutral-500">Redirecting to My Orders…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/cart" className="text-sm text-neutral-700 hover:text-neutral-950 underline">Back to Cart</Link>
        <div className="text-xs text-neutral-500">Cash on Delivery • India only</div>
      </div>

      {errorToast && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {errorToast}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left: Address ── */}
        <div className="card p-6 lg:col-span-3 space-y-5">
          <div>
            <div className="text-base font-semibold text-neutral-950">Delivery address</div>
            <div className="mt-1 text-sm text-neutral-500">Select a saved address or add a new one.</div>
          </div>

          {/* Saved addresses list */}
          {loadingAddresses ? (
            <div className="text-sm text-neutral-400">Loading saved addresses…</div>
          ) : savedAddresses.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Saved addresses</div>
              {savedAddresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => selectSavedAddress(addr)}
                  className={[
                    "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition",
                    selectedAddressId === addr.id
                      ? "border-neutral-900 bg-neutral-50 shadow-sm"
                      : "border-neutral-200 bg-white hover:border-neutral-400",
                  ].join(" ")}
                >
                  {/* Radio dot */}
                  <div className="mt-0.5 shrink-0">
                    <div className={["h-4 w-4 rounded-full border-2 flex items-center justify-center transition",
                      selectedAddressId === addr.id ? "border-neutral-900" : "border-neutral-300"].join(" ")}>
                      {selectedAddressId === addr.id && (
                        <div className="h-2 w-2 rounded-full bg-neutral-900" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900">{addr.full_name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.pincode}
                    </div>
                    <div className="text-xs text-neutral-500">{addr.phone}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteAddress(addr.id); }}
                    className="shrink-0 text-xs text-red-400 hover:text-red-600 transition"
                    title="Remove address"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add another address */}
              <button
                type="button"
                onClick={startNewAddress}
                className={[
                  "w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-semibold transition",
                  selectedAddressId === null
                    ? "border-neutral-900 bg-neutral-50 text-neutral-900"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700",
                ].join(" ")}
              >
                + Add another address
              </button>
            </div>
          ) : null}

          {/* Address form — shown when adding new or no saved addresses */}
          {(selectedAddressId === null || savedAddresses.length === 0) && (
            <div className="space-y-4">
              {savedAddresses.length > 0 && (
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">New address</div>
              )}

              <Field label="Full name">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((a) => ({ ...a, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                  placeholder="Your name"
                />
              </Field>

              <Field label="Phone number (India)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm((a) => ({ ...a, phone: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                  placeholder="10-digit mobile number"
                />
                <div className="mt-1 text-xs text-neutral-500">Example: 9876543210</div>
              </Field>

              <Field label="Address line 1">
                <input
                  value={form.line1}
                  onChange={(e) => setForm((a) => ({ ...a, line1: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                  placeholder="House / Flat, Street"
                />
              </Field>

              <Field label="Address line 2 (optional)">
                <input
                  value={form.line2}
                  onChange={(e) => setForm((a) => ({ ...a, line2: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                  placeholder="Landmark, Area"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City">
                  <input
                    value={form.city}
                    onChange={(e) => setForm((a) => ({ ...a, city: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                    placeholder="City"
                  />
                </Field>
                <Field label="State">
                  <input
                    value={form.state}
                    onChange={(e) => setForm((a) => ({ ...a, state: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                    placeholder="State"
                  />
                </Field>
              </div>

              <Field label="Pincode">
                <input
                  value={form.pincode}
                  onChange={(e) => setForm((a) => ({ ...a, pincode: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                  placeholder="6-digit pincode"
                />
              </Field>

              {/* Save address button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={saveAddress}
                  disabled={!isValidAddress(form) || savingAddress || addressSaved}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 shadow-sm disabled:opacity-40 transition"
                >
                  {savingAddress ? "Saving…" : addressSaved ? "Saved ✓" : "Save address"}
                </button>
                {addressSaved && (
                  <span className="text-xs text-emerald-600 font-medium">Address saved for future orders</span>
                )}
              </div>
            </div>
          )}

          {/* Validation hint */}
          {!canPlace && (activeAddress.fullName || activeAddress.line1) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Please fill all required fields: name, valid 10-digit phone, address, city, state, and 6-digit pincode.
            </div>
          )}
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="card p-6 lg:col-span-2">
          <div className="text-base font-semibold text-neutral-950">Order summary</div>
          <div className="mt-1 text-sm text-neutral-600">{totalItems} item(s)</div>

          <div className="mt-5 space-y-3">
            {(items || []).map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-neutral-950">{x.name}</div>
                  <div className="text-xs text-neutral-500">{money(x.unitPrice ?? x.price)} × {x.qty}</div>
                </div>
                <div className="text-sm font-semibold text-neutral-950">
                  {money((Number(x.unitPrice ?? x.price) || 0) * (Number(x.qty) || 0))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label="Shipping" value="Free" />
            <div className="flex items-center justify-between text-base font-semibold text-neutral-950 pt-1">
              <div>Total</div>
              <div>{money(total)}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button
              onClick={onPlaceOrder}
              disabled={!canPlace || loading}
              className="btn-primary w-full disabled:opacity-50 disabled:hover:shadow-none disabled:cursor-not-allowed"
            >
              {loading ? "Placing…" : "Place order (COD)"}
            </button>

            <button onClick={() => navigate("/cart")} className="btn-ghost w-full">
              Review cart
            </button>

            {!canPlace && !activeAddress.fullName && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                Select a saved address or fill in a new one above to enable checkout.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="pill">🔒 Secure checkout</span>
            <span className="pill">📦 Quality packaging</span>
            <span className="pill">🇮🇳 India only</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-neutral-700">
      <div>{label}</div>
      <div className="font-semibold text-neutral-950">{value}</div>
    </div>
  );
}
