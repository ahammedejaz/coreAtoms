/**
 * Checkout.jsx — Full checkout flow: address → payment method → pricing → payment → receipt.
 *
 * On mount, fetches `app_settings` in a single batched query:
 *   shipping_amount, free_shipping_min, gst_percentage, warehouse_address,
 *   razorpay_enabled, cod_enabled, corecoins_enabled, corecoins_config
 * Also loads user's saved addresses + CoreCoins wallet balance.
 * Coupons are validated server-side by the `validate_coupon` RPC — the
 * `discount_codes` setting itself is admin-only and never read here.
 *
 * Shipping rates:
 *   When admin flat rate = 0, calls `delhivery-pincode-check` Edge Function
 *   which returns separate rates for prepaid (shipping_charge_prepaid) and
 *   COD (shipping_charge_cod, includes COD surcharge via Delhivery `pt=COD`).
 *   User selects payment method first; billing updates reactively.
 *   If the lookup fails we fall back to the configured flat rate, so checkout
 *   never deadlocks waiting on a rate that will not arrive.
 *
 * Pricing formula (computed on the client, verified server-side by RPCs):
 *   shipping    = 0 (free) | pincodeRate (COD or prepaid) | flatRate (admin)
 *   discount    = Math.round(subtotal * couponPercent / 100)
 *   taxable     = subtotal - discount            (GST is levied post-discount)
 *   gstAmount   = Math.round(taxable * gstPercent / 100)      (0 if gst = 0)
 *   coinDiscount = coinsUsed * coin_value_inr    (capped so prepaid stays ≥ ₹1)
 *   total       = taxable + shipping + gstAmount - coinDiscount
 *
 * COD path:
 *   supabase.rpc('place_order_cod', { p_shipping, p_gst, p_coins_used, … })
 *   → clears the cart, stores orderReceipt state → receipt card with a
 *     "View my orders" link → auto-navigates to /orders after 5 s
 *
 * Prepaid (Razorpay) path:
 *   1. Edge fn `create-razorpay-order` → opens Razorpay modal
 *   2. onSuccess → Edge fn `verify-razorpay-payment` (HMAC verify + place_order_prepaid)
 *   3. If verification fails → RPC `log_failed_order` (status = 'payment_failed')
 *   → clears the cart, stores orderReceipt state → receipt card with a
 *     "View my orders" link → auto-navigates to /orders after 5 s
 *
 * @module pages/Checkout
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
  const [editingAddressId, setEditingAddressId] = useState(null); // id of address being edited

  // Confirmation state for address deletion (replaces window.confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Order state
  const [placed, setPlaced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState(null); // captured at placement time
  const redirectTimer = useRef(null); // post-order navigation timer, cleared on unmount

  // Shipping amount (from app_settings)
  const [shippingBase, setShippingBase] = useState(0);
  const [freeShippingMin, setFreeShippingMin] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [warehouseState, setWarehouseState] = useState("Andhra Pradesh");
  const [pincodeShippingPrepaid, setPincodeShippingPrepaid] = useState(null); // prepaid rate from Delhivery
  const [pincodeShippingCod, setPincodeShippingCod] = useState(null); // COD rate from Delhivery
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingPinLabel, setShippingPinLabel] = useState(""); // pincode the rate was calculated for
  const shippingAbort = useRef(null);

  // Payment method selection (affects shipping cost when using pincode-based pricing)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cod");

  // Razorpay toggle (read from app_settings)
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);

  // COD toggle (read from app_settings, defaults to true)
  const [codAvailable, setCodAvailable] = useState(true);

  // Coupon / discount
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try { const c = sessionStorage.getItem("coreatoms_coupon"); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // CoreCoins
  const [corecoinsEnabled, setCorecoinsEnabled] = useState(false);
  const [corecoinsConfig, setCorecoinsConfig] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [useCoins, setUseCoins] = useState(false);

  // ─── Load every checkout setting in one round-trip ────────────────────────
  useEffect(() => {
    let cancelled = false;
    supabase.from("app_settings").select("key,value")
      .in("key", [
        "razorpay_enabled",
        "cod_enabled",
        "shipping_amount",
        "free_shipping_min",
        "gst_percentage",
        "warehouse_address",
        "corecoins_enabled",
        "corecoins_config",
      ])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("app_settings load failed:", error); return; }
        const map = {};
        (data || []).forEach((row) => { map[row.key] = row.value; });

        // Razorpay needs both the admin toggle AND a configured key
        setRazorpayAvailable(map.razorpay_enabled?.enabled === true && !!getRazorpayKeyId());
        // COD defaults to true if the setting doesn't exist
        setCodAvailable(map.cod_enabled?.enabled !== false);

        const ship = Number(map.shipping_amount?.amount);
        if (Number.isFinite(ship) && ship >= 0) setShippingBase(ship);
        const freeMin = Number(map.free_shipping_min?.amount);
        if (Number.isFinite(freeMin) && freeMin >= 0) setFreeShippingMin(freeMin);
        const gst = Number(map.gst_percentage?.percentage);
        if (Number.isFinite(gst) && gst >= 0) setGstPercent(gst);
        // Warehouse state drives the CGST/SGST vs IGST split
        const st = map.warehouse_address?.state;
        if (st && typeof st === "string") setWarehouseState(st.trim());

        setCorecoinsEnabled(map.corecoins_enabled?.enabled === true);
        if (map.corecoins_config && typeof map.corecoins_config === "object") setCorecoinsConfig(map.corecoins_config);
      });
    return () => { cancelled = true; };
  }, []);

  // Re-validate a coupon carried over in sessionStorage. Validation is
  // server-side now, so a stale or revoked code is dropped before checkout.
  useEffect(() => {
    let stored;
    try { stored = JSON.parse(sessionStorage.getItem("coreatoms_coupon") || "null"); } catch { stored = null; }
    if (!stored?.code) return;
    let cancelled = false;
    supabase.rpc("validate_coupon", { p_code: stored.code })
      .then(({ data, error }) => {
        if (cancelled || error) return; // RPC unavailable — leave it to the order RPC
        const res = Array.isArray(data) ? data[0] : data;
        if (!res?.valid) {
          sessionStorage.removeItem("coreatoms_coupon");
          setAppliedCoupon(null);
        } else {
          const fresh = { code: stored.code, percentage: Number(res.percentage) || 0 };
          sessionStorage.setItem("coreatoms_coupon", JSON.stringify(fresh));
          setAppliedCoupon(fresh);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Reconcile the selected payment method once availability loads — otherwise a
  // store with COD switched off renders no payment button at all.
  useEffect(() => {
    if (selectedPaymentMethod === "cod" && !codAvailable && razorpayAvailable) {
      setSelectedPaymentMethod("prepaid");
    } else if (selectedPaymentMethod === "prepaid" && !razorpayAvailable && codAvailable) {
      setSelectedPaymentMethod("cod");
    }
  }, [codAvailable, razorpayAvailable, selectedPaymentMethod]);

  // Cancel the post-order redirect if the page unmounts first
  useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

  // Fetch user's CoreCoins balance
  useEffect(() => {
    if (!user?.id || !corecoinsEnabled) return;
    supabase.from("corecoins_wallet").select("balance")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCoinBalance(Number(data?.balance || 0)));
  }, [user?.id, corecoinsEnabled]);

  // ─── Fetch shipping charge from Delhivery when address pincode changes ────
  useEffect(() => {
    // If admin set a flat rate > 0, use that instead — skip Delhivery
    if (shippingBase > 0) {
      setPincodeShippingPrepaid(null);
      setPincodeShippingCod(null);
      setShippingPinLabel("");
      setShippingLoading(false); // clear any in-flight loading state
      return;
    }

    const pin = (form.pincode || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      setPincodeShippingPrepaid(null);
      setPincodeShippingCod(null);
      setShippingPinLabel("");
      setShippingLoading(false);
      return;
    }
    // Abort previous request
    if (shippingAbort.current) shippingAbort.current.abort();
    const controller = new AbortController();
    shippingAbort.current = controller;

    // When the lookup fails we apply the configured flat rate rather than
    // leaving the rate unresolved — an unresolved rate blocks `canPlace`
    // forever. shippingBase of 0 is a legitimate value meaning free shipping.
    const applyFlatRateFallback = () => {
      setPincodeShippingPrepaid(shippingBase);
      setPincodeShippingCod(shippingBase);
      setShippingPinLabel(""); // not a pincode-specific rate, don't claim it is
      showToast(
        shippingBase > 0
          ? `Could not fetch a live shipping rate — our standard rate of ${money(shippingBase)} applies.`
          : "Could not fetch a live shipping rate — standard shipping applies (free on this order).",
        "warning", 4000
      );
    };

    setShippingLoading(true);
    supabase.functions.invoke("delhivery-pincode-check", { body: { pincode: pin } })
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        const prepaidCharge = data?.shipping_charge_prepaid ?? data?.shipping_charge;
        const codCharge = data?.shipping_charge_cod;
        if (!error && prepaidCharge !== null && prepaidCharge !== undefined && Number.isFinite(Number(prepaidCharge))) {
          setPincodeShippingPrepaid(Math.ceil(Number(prepaidCharge)));
          setPincodeShippingCod(codCharge !== null && codCharge !== undefined && Number.isFinite(Number(codCharge)) ? Math.ceil(Number(codCharge)) : Math.ceil(Number(prepaidCharge)));
          setShippingPinLabel(pin);
        } else {
          // Edge function errored or returned no rate — fall back to flat rate
          if (error) console.error("delhivery-pincode-check failed:", error);
          applyFlatRateFallback();
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          console.error("delhivery-pincode-check threw:", e);
          applyFlatRateFallback();
        }
      })
      .finally(() => { if (!controller.signal.aborted) setShippingLoading(false); });

    return () => {
      controller.abort();
      setShippingLoading(false); // always clear loading when effect is cleaned up
    };
  }, [form.pincode, shippingBase]);

  const sub = Number(subtotal || 0);
  // shippingResolved: true when we have a definitive shipping amount
  // In pincode-mode (shippingBase=0), must wait for Delhivery to return a valid rate
  const pincodeShipping = selectedPaymentMethod === "cod" ? pincodeShippingCod : pincodeShippingPrepaid;
  const shippingResolved = shippingBase > 0 || (freeShippingMin > 0 && sub >= freeShippingMin) || pincodeShipping !== null;
  const effectiveBase = pincodeShipping !== null ? pincodeShipping : shippingBase;
  const qualifiesFreeShipping = freeShippingMin > 0 && sub >= freeShippingMin;
  const shipping = qualifiesFreeShipping ? 0 : effectiveBase;

  // Indian GST is levied on the discounted taxable value, so the coupon comes
  // off first. The order RPCs re-derive the same way server-side.
  const discountAmount = appliedCoupon ? Math.round((sub * appliedCoupon.percentage) / 100) : 0;
  const taxableAmount = Math.max(0, sub - discountAmount);
  const gstAmount = gstPercent > 0 ? Math.round((taxableAmount * gstPercent) / 100) : 0;

  // GST split: CGST+SGST for intra-state (Andhra Pradesh), IGST for inter-state
  const deliveryState = (form.state || "").trim();
  const isIntraState = deliveryState.toLowerCase() === warehouseState.toLowerCase();
  const halfGst = gstPercent / 2;  // e.g. 5% → 2.5%
  const halfGstAmount = gstAmount > 0 ? Math.round(gstAmount / 2) : 0;

  // CoreCoins discount calculation
  const minRedeem = Number(corecoinsConfig?.min_redeem || 0);
  const coinValueInr = Number(corecoinsConfig?.coin_value_inr || 1);
  const canUseCoins = corecoinsEnabled && corecoinsConfig && coinBalance >= minRedeem;
  const preCoinsTotal = Math.max(0, taxableAmount + shipping + gstAmount);
  // Razorpay rejects a ₹0 order, so an online payment must stay at least ₹1.
  // COD may still be redeemed all the way down to ₹0.
  const minPayable = selectedPaymentMethod === "prepaid" ? 1 : 0;
  const maxCoinsDiscount = Math.max(0, preCoinsTotal - minPayable);
  const coinsDiscount = (useCoins && canUseCoins) ? Math.min(Math.floor(coinBalance * coinValueInr), maxCoinsDiscount) : 0;
  const coinsUsed = coinValueInr > 0 ? Math.ceil(coinsDiscount / coinValueInr) : 0;
  const total = Math.max(0, preCoinsTotal - coinsDiscount);
  const amountToFreeShipping = freeShippingMin > 0 && !qualifiesFreeShipping ? freeShippingMin - sub : 0;

  // Coupon apply handler — validated entirely server-side by `validate_coupon`,
  // which checks the schedule, email and first-time-customer restrictions.
  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    setCouponError("");
    if (!code) { setCouponError("Enter a coupon code"); return; }
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.rpc("validate_coupon", { p_code: code });
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;
      if (!res?.valid) {
        setCouponError(res?.message || "Invalid or expired coupon code");
        return;
      }
      const applied = { code, percentage: Number(res.percentage) || 0 };
      setAppliedCoupon(applied);
      sessionStorage.setItem("coreatoms_coupon", JSON.stringify(applied));
      setCouponInput("");
      showToast(`Coupon "${applied.code}" applied — ${applied.percentage}% off!`, "success");
    } catch (e) {
      console.error("validate_coupon failed:", e);
      setCouponError("Could not check this coupon right now. Please try again.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    sessionStorage.removeItem("coreatoms_coupon");
    setCouponError("");
    showToast("Coupon removed", "info");
  };

  // Track whether we've done the initial auto-select
  const didAutoSelect = useRef(false);

  // Load saved addresses from Supabase
  const loadAddresses = useCallback(async () => {
    if (!user?.id) return;
    setLoadingAddresses(true);
    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = data || [];
    setSavedAddresses(list);
    // Auto-select the most recent saved address only on initial load
    if (list.length > 0 && !didAutoSelect.current) {
      didAutoSelect.current = true;
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
    setPendingDeleteId(null);
  };

  // Start a new blank address form
  const startNewAddress = () => {
    setSelectedAddressId(null);
    setEditingAddressId(null);
    setForm(EMPTY_ADDRESS);
    setAddressSaved(false);
    setPendingDeleteId(null);
  };

  // Start editing a saved address
  const startEditAddress = (addr) => {
    setEditingAddressId(addr.id);
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

  // Save current form — insert new or update existing
  const saveAddress = async () => {
    if (!isValidAddress(form) || !user?.id) return;
    setSavingAddress(true);
    const payload = {
      full_name: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
    };

    if (editingAddressId) {
      // Update existing address
      const { error } = await supabase
        .from("user_addresses")
        .update(payload)
        .eq("id", editingAddressId)
        .eq("user_id", user.id);
      setSavingAddress(false);
      if (error) { showToast(error.message, "error"); return; }
      setAddressSaved(true);
      showToast("Address updated", "success");
      setEditingAddressId(null);
      await loadAddresses();
      setSelectedAddressId(editingAddressId);
    } else {
      // Insert new address
      const { data, error } = await supabase
        .from("user_addresses")
        .insert([{ user_id: user.id, ...payload }])
        .select()
        .single();
      setSavingAddress(false);
      if (error) { showToast(error.message, "error"); return; }
      setAddressSaved(true);
      showToast("Address saved", "success");
      await loadAddresses();
      setSelectedAddressId(data.id);
    }
  };

  // Delete a saved address (with inline confirmation instead of window.confirm)
  const confirmDeleteAddress = async (id) => {
    await supabase.from("user_addresses").delete().eq("id", id).eq("user_id", user.id);
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
  const addressComplete = isValidAddress(activeAddress);
  const canPlace =
    !!user &&
    totalItems > 0 &&
    addressComplete &&
    shippingResolved &&     // must have a confirmed shipping rate
    !shippingLoading;       // not currently fetching

  // Name the actual blocker — `canPlace` is also false while shipping resolves,
  // and blaming the address form for that is misleading.
  const blockerMessage = !user
    ? "Sign in to place this order."
    : totalItems === 0
      ? "Your cart is empty — add something before checking out."
      : !addressComplete
        ? "Fill all required fields — name, valid 10-digit phone, address, city, state, 6-digit pincode."
        : shippingLoading
          ? "Working out shipping for your pincode — one moment…"
          : !shippingResolved
            ? "We couldn't work out shipping for this pincode yet. Re-check the pincode and try again."
            : "";

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
      product_name: x.name || "Product",
      image_url: x.image || "",
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
        p_coins_used: coinsUsed,
        p_shipping: shipping,
        p_gst: gstAmount,
        p_discount: discountAmount,
        p_coupon_code: appliedCoupon?.code || null,
      });
      if (error) throw error;
      // Capture receipt before clearing cart
      setOrderReceipt({
        items: items.map(x => ({ name: x.name, qty: Number(x.qty), unitPrice: Number(x.unitPrice ?? x.price ?? 0) })),
        itemsTotal: sub,
        shipping,
        gstAmount,
        gstPercent,
        isIntraState,
        halfGst,
        halfGstAmount,
        discountAmount,
        coupon: appliedCoupon ? { code: appliedCoupon.code, percentage: appliedCoupon.percentage } : null,
        coinsUsed,
        coinsDiscount,
        total,
        paymentMethod: 'cod',
      });
      setPlaced(true);
      // Empty the cart immediately — the receipt above renders from the
      // snapshot, so a shopper who closes the tab can't re-order what they
      // just bought. Only the redirect stays on a timer.
      clear();
      redirectTimer.current = setTimeout(() => navigate("/orders"), 5000);
    } catch (e) {
      const msg = e?.message || "Unknown error";
      if (msg.toLowerCase().includes("insufficient")) {
        showToast("Some items are out of stock. Please reduce quantity and try again.", "warning", 4000);
      } else {
        console.error("place_order_cod failed:", e);
        showToast("We couldn't place your order. Please try again in a moment.", "error", 4000);
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
          } catch { /* ignore parse errors */ }
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
            const { error: verifyErr } = await supabase.functions.invoke(
              "verify-razorpay-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  user_id: user.id,
                  address: activeAddress,
                  items: buildPayloadItems(),
                  coins_used: coinsUsed,
                  shipping: shipping,
                  gst: gstAmount,
                  discount: discountAmount,
                  coupon_code: appliedCoupon?.code || null,
                },
              }
            );
            if (verifyErr) {
              let detail = verifyErr.message || "Payment verification failed";
              if (verifyErr.context && typeof verifyErr.context.json === "function") {
                try {
                  const errBody = await verifyErr.context.json();
                  detail = errBody?.error || errBody?.message || detail;
                } catch { /* ignore parse errors */ }
              }
              // Log failed order so it appears in My Orders
              supabase.rpc("log_failed_order", {
                p_user_id: user.id,
                p_address: activeAddress,
                p_items: buildPayloadItems(),
                p_reason: detail,
                p_shipping: shipping,
                p_gst: gstAmount,
              }).catch(() => { });
              throw new Error(detail);
            }
            // Capture receipt before clearing cart
            setOrderReceipt({
              items: items.map(x => ({ name: x.name, qty: Number(x.qty), unitPrice: Number(x.unitPrice ?? x.price ?? 0) })),
              itemsTotal: sub,
              shipping,
              gstAmount,
              gstPercent,
              isIntraState,
              halfGst,
              halfGstAmount,
              discountAmount,
              coupon: appliedCoupon ? { code: appliedCoupon.code, percentage: appliedCoupon.percentage } : null,
              coinsUsed,
              coinsDiscount,
              total,
              paymentMethod: 'prepaid',
              razorpayPaymentId: response.razorpay_payment_id,
            });
            setPlaced(true);
            // Cart is emptied straight away — the receipt renders from the
            // snapshot above, so closing the tab can't leave paid-for items
            // sitting in the cart ready to be ordered a second time.
            clear();
            redirectTimer.current = setTimeout(() => navigate("/orders"), 5000);
          } catch (vErr) {
            console.error("Order creation after payment failed:", vErr);
            showToast(
              `Payment received, but we couldn't finalise your order. Please contact support with payment ID ${response.razorpay_payment_id}.`,
              "error", 6000
            );
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
      console.error("Razorpay payment could not be started:", e);
      showToast("We couldn't start the payment. Please try again in a moment.", "error", 4000);
      setPayingOnline(false);
    }
  };

  if (placed && orderReceipt) {
    const r = orderReceipt;
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-md space-y-4">
          {/* Success header */}
          <div className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-2xl">✓</div>
            <h2 className="text-xl font-semibold text-stone-900">Order Placed!</h2>
            <p className="mt-1 text-sm text-stone-500">Thank you. We're preparing your order for dispatch.</p>
          </div>

          {/* Receipt card */}
          <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
            {/* Header */}
            <div className="bg-stone-50 border-b border-[#E8E4DE] px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">Order Summary</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.paymentMethod === 'prepaid'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                {r.paymentMethod === 'prepaid' ? '💳 Online paid' : '💵 Cash on Delivery'}
              </span>
            </div>

            {/* Items */}
            <div className="px-5 py-4 space-y-2">
              {r.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-stone-700 truncate max-w-[200px]">{it.name} <span className="text-stone-400">×{it.qty}</span></span>
                  <span className="font-medium text-stone-900 ml-2">{money(it.unitPrice * it.qty)}</span>
                </div>
              ))}
            </div>

            {/* Totals breakdown */}
            <div className="border-t border-dashed border-[#E8E4DE] mx-5" />
            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Items subtotal</span>
                <span className="text-stone-800">{money(r.itemsTotal)}</span>
              </div>
              {r.shipping > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Shipping</span>
                  <span className="text-stone-800">{money(r.shipping)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
              )}
              {r.gstAmount > 0 && (
                r.isIntraState ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">CGST ({r.halfGst}%)</span>
                      <span className="text-stone-800">{money(r.halfGstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">SGST ({r.halfGst}%)</span>
                      <span className="text-stone-800">{money(r.gstAmount - r.halfGstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">IGST ({r.gstPercent}%)</span>
                    <span className="text-stone-800">{money(r.gstAmount)}</span>
                  </div>
                )
              )}
              {r.coupon && r.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 flex items-center gap-1">
                    🎉 Coupon <span className="font-mono font-bold">{r.coupon.code}</span> ({r.coupon.percentage}% off)
                  </span>
                  <span className="text-emerald-700 font-medium">−{money(r.discountAmount)}</span>
                </div>
              )}
              {r.coinsUsed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" /></svg>
                    CoreCoins ({r.coinsUsed} coins)
                  </span>
                  <span className="text-amber-700 font-medium">−{money(r.coinsDiscount)}</span>
                </div>
              )}
              <div className="border-t border-[#E8E4DE] pt-2 flex justify-between">
                <span className="font-semibold text-stone-800">Total Paid</span>
                <span className="text-lg font-bold text-stone-900">{money(r.total)}</span>
              </div>
            </div>

            {/* Razorpay ID if prepaid */}
            {r.razorpayPaymentId && (
              <div className="border-t border-[#E8E4DE] px-5 py-3">
                <span className="text-[10px] text-stone-400">Payment ID: </span>
                <span className="font-mono text-[10px] text-stone-500">{r.razorpayPaymentId}</span>
              </div>
            )}
          </div>

          {/* Navigation — never rely on the redirect timer alone */}
          <Link to="/orders" className="btn-primary w-full py-3 text-[14px] flex items-center justify-center">
            View my orders
          </Link>
          <p className="text-center text-xs text-stone-400">Taking you there automatically in a few seconds…</p>
        </div>
      </div>
    );
  }

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
        <p className="text-sm text-stone-500 mt-1">
          {selectedPaymentMethod === "prepaid" ? "Secure online payment · India only" : "Cash on Delivery · India only"}
        </p>
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
              <div role="radiogroup" aria-label="Saved addresses" className="space-y-3">
                {savedAddresses.map((addr) => (
                <div key={addr.id}
                  role="radio"
                  aria-checked={selectedAddressId === addr.id}
                  tabIndex={0}
                  onClick={() => selectSavedAddress(addr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSavedAddress(addr); }
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/30 ${selectedAddressId === addr.id
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
                  {/* Edit & Delete buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => startEditAddress(addr)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-all active:scale-95" title="Edit address">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                    {pendingDeleteId === addr.id ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => confirmDeleteAddress(addr.id)}
                          className="h-7 px-2.5 flex items-center justify-center rounded-lg bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 transition-all active:scale-95">Remove</button>
                        <button type="button" onClick={() => setPendingDeleteId(null)}
                          className="h-7 px-2.5 flex items-center justify-center rounded-lg bg-stone-100 text-stone-500 text-[11px] font-semibold hover:bg-stone-200 transition-all active:scale-95">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setPendingDeleteId(addr.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all active:scale-95" title="Delete address">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                ))}
              </div>
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

          {/* Address form — shown for new address OR when editing (hidden while addresses are loading) */}
          {!loadingAddresses && (selectedAddressId === null || savedAddresses.length === 0 || editingAddressId) && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  {editingAddressId ? "Edit address" : savedAddresses.length > 0 ? "New address" : ""}
                </p>
                {editingAddressId && (
                  <button type="button" onClick={() => {
                    // The address may have been deleted from under us — fall
                    // back to a blank form rather than blowing up on undefined.
                    const original = savedAddresses.find(a => a.id === editingAddressId);
                    setEditingAddressId(null);
                    if (original) selectSavedAddress(original); else startNewAddress();
                  }}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Cancel editing</button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="addr-fullname" className="text-xs font-semibold text-stone-500 block mb-1.5">Full name *</label>
                  <input id="addr-fullname" value={form.fullName} onChange={(e) => setForm(a => ({ ...a, fullName: e.target.value }))} placeholder="Your name" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="addr-phone" className="text-xs font-semibold text-stone-500 block mb-1.5">Phone (India) *</label>
                  <input id="addr-phone" type="text" inputMode="numeric" maxLength={10}
                    value={form.phone}
                    onChange={(e) => setForm(a => ({ ...a, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    placeholder="10-digit mobile" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="addr-line1" className="text-xs font-semibold text-stone-500 block mb-1.5">Address line 1 *</label>
                <input id="addr-line1" value={form.line1} onChange={(e) => setForm(a => ({ ...a, line1: e.target.value }))} placeholder="House / Flat, Street" className={inputCls} />
              </div>
              <div>
                <label htmlFor="addr-line2" className="text-xs font-semibold text-stone-500 block mb-1.5">Address line 2 (optional)</label>
                <input id="addr-line2" value={form.line2} onChange={(e) => setForm(a => ({ ...a, line2: e.target.value }))} placeholder="Landmark, Area" className={inputCls} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="addr-city" className="text-xs font-semibold text-stone-500 block mb-1.5">City *</label>
                  <input id="addr-city" value={form.city} onChange={(e) => setForm(a => ({ ...a, city: e.target.value }))} placeholder="City" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="addr-state" className="text-xs font-semibold text-stone-500 block mb-1.5">State *</label>
                  <select id="addr-state" value={form.state} onChange={(e) => setForm(a => ({ ...a, state: e.target.value }))} className={inputCls}>
                    <option value="">Select state</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                    <option value="Ladakh">Ladakh</option>
                    <option value="Lakshadweep">Lakshadweep</option>
                    <option value="Puducherry">Puducherry</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="addr-pincode" className="text-xs font-semibold text-stone-500 block mb-1.5">Pincode *</label>
                  <input id="addr-pincode" type="text" inputMode="numeric" maxLength={6}
                    value={form.pincode}
                    onChange={(e) => setForm(a => ({ ...a, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    placeholder="6 digits" className={inputCls} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={saveAddress} disabled={!isValidAddress(form) || savingAddress || addressSaved}
                  className={`btn-ghost text-sm py-2 px-4 ${addressSaved ? "border-emerald-300 text-emerald-600" : ""}`}>
                  {savingAddress ? "Saving…" : addressSaved ? "Saved ✓" : editingAddressId ? "Update address" : "Save address"}
                </button>
                {addressSaved && <span className="text-xs text-emerald-600">{editingAddressId ? "Address updated" : "Address saved for future orders"}</span>}
              </div>
            </div>
          )}

          {!canPlace && blockerMessage && (form.fullName || form.line1) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {blockerMessage}
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

            {/* Coupon code input */}
            <div className="mb-5">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700">🎉</span>
                    <span className="font-mono text-sm font-semibold text-emerald-800">{appliedCoupon.code}</span>
                    <span className="text-xs text-emerald-600">{appliedCoupon.percentage}% off</span>
                  </div>
                  <button type="button" onClick={removeCoupon}
                    className="text-xs text-emerald-600 hover:text-red-500 transition-colors">✕ Remove</button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                      placeholder="Coupon code"
                      onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                      className="flex-1 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono text-stone-900 uppercase placeholder:text-stone-400 placeholder:normal-case focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] outline-none transition" />
                    <button type="button" onClick={applyCoupon} disabled={validatingCoupon}
                      className="btn-ghost text-sm py-2.5 px-4 shrink-0 disabled:opacity-50">{validatingCoupon ? "Checking…" : "Apply"}</button>
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Payment method selector — always visible */}
            {(codAvailable || razorpayAvailable) && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Payment Method</p>
                <div className="flex gap-2">
                  {codAvailable && (
                    <button type="button" onClick={() => setSelectedPaymentMethod("cod")}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${selectedPaymentMethod === "cod"
                        ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] ring-2 ring-[#1e3a5f]/10"
                        : "border-[#E8E4DE] bg-white text-stone-500 hover:border-stone-300"
                        }`}>
                      💵 Cash on Delivery
                    </button>
                  )}
                  {razorpayAvailable && (
                    <button type="button" onClick={() => setSelectedPaymentMethod("prepaid")}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${selectedPaymentMethod === "prepaid"
                        ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB] ring-2 ring-[#2563EB]/10"
                        : "border-[#E8E4DE] bg-white text-stone-500 hover:border-stone-300"
                        }`}>
                      💳 Pay Online
                    </button>
                  )}
                </div>

              </div>
            )}

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <div>
                  <span>Shipping</span>
                  {shippingLoading && (
                    <span className="ml-1.5 text-[11px] text-stone-400 animate-pulse">Calculating...</span>
                  )}
                  {!shippingLoading && shippingPinLabel && (
                    <span className="ml-1.5 text-[11px] text-stone-400">(to {shippingPinLabel})</span>
                  )}
                </div>
                <span className={`font-semibold ${!shippingResolved ? "text-rose-500" : shipping === 0 ? "text-emerald-600" : "text-stone-900"}`}>
                  {shippingLoading ? "..." : !shippingResolved ? "—" : shipping === 0 ? "Free" : money(shipping)}
                </span>
              </div>
              {/* Show warning when pincode-based shipping is not yet resolved */}
              {!shippingLoading && !shippingResolved && isValidAddress(activeAddress) && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                  ⚠️ Enter a <strong>valid 6-digit pincode</strong> to see shipping charges before placing your order.
                </div>
              )}
              {amountToFreeShipping > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  🚚 Add {money(amountToFreeShipping)} more for <span className="font-semibold">free shipping!</span>
                </div>
              )}
              {qualifiesFreeShipping && effectiveBase > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                  ✅ You qualify for <span className="font-semibold">free shipping!</span>
                </div>
              )}
              {gstPercent > 0 && (
                isIntraState ? (
                  <>
                    <div className="flex justify-between text-stone-600">
                      <span>CGST ({halfGst}%)</span>
                      <span className="font-semibold text-stone-900">{money(halfGstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>SGST ({halfGst}%)</span>
                      <span className="font-semibold text-stone-900">{money(gstAmount - halfGstAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-stone-600">
                    <span>IGST ({gstPercent}%)</span>
                    <span className="font-semibold text-stone-900">{money(gstAmount)}</span>
                  </div>
                )
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({appliedCoupon.percentage}%)</span>
                  <span className="font-semibold">-{money(discountAmount)}</span>
                </div>
              )}
              {coinsDiscount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>CoreCoins ({coinsUsed} coins)</span>
                  <span className="font-semibold">-{money(coinsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-stone-900 pt-1"><span>Total</span><span>{money(total)}</span></div>

              {/* CoreCoins earn preview */}
              {corecoinsEnabled && corecoinsConfig && (() => {
                const earnPer = Number(corecoinsConfig.earn_per_rupees || 100);
                const earnRate = Number(corecoinsConfig.earn_rate || 1);
                const willEarn = Math.floor(total * earnRate / earnPer);
                if (willEarn <= 0) return null;
                return (
                  <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-dashed border-amber-200">
                    <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-1.5l3-2V8H9V6.5h4V10l-2 1.5V13z" />
                    </svg>
                    <span className="text-xs text-amber-700">You'll earn <strong>{willEarn} CoreCoins</strong> with this purchase</span>
                  </div>
                );
              })()}
            </div>

            {/* CoreCoins redemption */}
            {corecoinsEnabled && corecoinsConfig && (
              <div className="mb-5">
                <div className={`rounded-xl border px-4 py-3 ${canUseCoins ? "border-amber-200 bg-amber-50" : "border-[#E8E4DE] bg-stone-50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🪙</span>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {coinBalance} CoreCoin{coinBalance !== 1 ? "s" : ""}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {canUseCoins
                            ? `Worth ${money(Math.floor(coinBalance * coinValueInr))} — save on this order!`
                            : coinBalance > 0
                              ? `Need ${minRedeem} coins to redeem (you have ${coinBalance})`
                              : "Earn coins on every purchase!"
                          }
                        </p>
                      </div>
                    </div>
                    {canUseCoins && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={useCoins} onChange={(e) => setUseCoins(e.target.checked)}
                          className="rounded border-stone-300 text-amber-500 focus:ring-amber-500/30 h-4 w-4" />
                        <span className="text-xs font-semibold text-stone-700">Use coins</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Single action button based on selected payment method */}
              {selectedPaymentMethod === "cod" && codAvailable && (
                <button onClick={onPlaceOrder} disabled={!canPlace || loading || payingOnline}
                  className="btn-primary w-full py-3 text-[14px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {loading ? "Placing order…" : "Place Order · Cash on Delivery"}
                </button>
              )}

              {selectedPaymentMethod === "prepaid" && razorpayAvailable && (
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
                      Pay Now · Online
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

              {codAvailable && razorpayAvailable && (
                <div className="text-center text-[11px] text-stone-400">Select your preferred payment method above</div>
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
