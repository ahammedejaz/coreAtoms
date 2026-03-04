/**
 * Checkout.jsx — Full checkout flow: address → pricing → payment → receipt.
 *
 * On mount, fetches in parallel from `app_settings`:
 *   shipping_amount, free_shipping_min, gst_percentage,
 *   razorpay_enabled, cod_enabled, discount_codes,
 *   corecoins_enabled, corecoins_config
 * Also loads user's saved addresses + CoreCoins wallet balance.
 *
 * Pricing formula (computed on the client, verified server-side by RPCs):
 *   shipping    = 0 (free) | pincodeRate (Delhivery API) | flatRate (admin)
 *   gstAmount   = Math.round(subtotal * gstPercent / 100)     (0 if gst = 0)
 *   coinDiscount = coinsUsed * coin_value_inr
 *   total       = subtotal + shipping + gstAmount - coinDiscount
 *
 * COD path:
 *   supabase.rpc('place_order_cod', { p_shipping, p_gst, p_coins_used, … })
 *   → stores orderReceipt state → shows receipt card for 5 s → navigate('/orders')
 *
 * Prepaid (Razorpay) path:
 *   1. Edge fn `create-razorpay-order` → opens Razorpay modal
 *   2. onSuccess → Edge fn `verify-razorpay-payment` (HMAC verify + place_order_prepaid)
 *   3. If verification fails → RPC `log_failed_order` (status = 'payment_failed')
 *   → stores orderReceipt state → shows receipt card for 5 s → navigate('/orders')
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

  // Shipping amount (from app_settings)
  const [shippingBase, setShippingBase] = useState(0);
  const [freeShippingMin, setFreeShippingMin] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [pincodeShipping, setPincodeShipping] = useState(null); // from Delhivery API
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingPinLabel, setShippingPinLabel] = useState(""); // pincode the rate was calculated for
  const shippingAbort = useRef(null);

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
  const [discountCodes, setDiscountCodes] = useState([]);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // CoreCoins
  const [corecoinsEnabled, setCorecoinsEnabled] = useState(false);
  const [corecoinsConfig, setCorecoinsConfig] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [useCoins, setUseCoins] = useState(false);

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

    // Load discount codes + re-validate any session-stored coupon
    supabase.from("app_settings").select("value")
      .eq("key", "discount_codes").maybeSingle()
      .then(({ data }) => {
        const codes = Array.isArray(data?.value) ? data.value : [];
        setDiscountCodes(codes);

        // Re-validate session-stored coupon against latest DB state
        try {
          const stored = sessionStorage.getItem("coreatoms_coupon");
          if (stored) {
            const parsed = JSON.parse(stored);
            const match = codes.find(c => c.code === parsed.code && c.active);
            let invalid = false;
            if (!match) {
              invalid = true;
            } else {
              const now = new Date();
              if (match.startsAt && new Date(match.startsAt) > now) invalid = true;
              if (match.endsAt && new Date(match.endsAt) < now) invalid = true;
            }
            if (invalid) {
              sessionStorage.removeItem("coreatoms_coupon");
              setAppliedCoupon(null);
            }
          }
        } catch { /* ignore parse errors */ }
      });

    // Load shipping amount
    supabase.from("app_settings").select("value")
      .eq("key", "shipping_amount").maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value?.amount);
        if (Number.isFinite(n) && n >= 0) setShippingBase(n);
      });
    // Load free-shipping threshold
    supabase.from("app_settings").select("value")
      .eq("key", "free_shipping_min").maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value?.amount);
        if (Number.isFinite(n) && n >= 0) setFreeShippingMin(n);
      });
    supabase.from("app_settings").select("value")
      .eq("key", "gst_percentage").maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value?.percentage);
        if (Number.isFinite(n) && n >= 0) setGstPercent(n);
      });

    // CoreCoins
    supabase.from("app_settings").select("value")
      .eq("key", "corecoins_enabled").maybeSingle()
      .then(({ data }) => setCorecoinsEnabled(data?.value?.enabled === true));
    supabase.from("app_settings").select("value")
      .eq("key", "corecoins_config").maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") setCorecoinsConfig(data.value);
      });
  }, []);

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
      setPincodeShipping(null);
      setShippingPinLabel("");
      setShippingLoading(false); // clear any in-flight loading state
      return;
    }

    const pin = (form.pincode || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      setPincodeShipping(null);
      setShippingPinLabel("");
      setShippingLoading(false);
      return;
    }
    // Abort previous request
    if (shippingAbort.current) shippingAbort.current.abort();
    const controller = new AbortController();
    shippingAbort.current = controller;

    setShippingLoading(true);
    supabase.functions.invoke("delhivery-pincode-check", { body: { pincode: pin } })
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        const charge = data?.shipping_charge;
        if (!error && charge !== null && charge !== undefined && Number.isFinite(Number(charge))) {
          setPincodeShipping(Math.ceil(Number(charge)));
          setShippingPinLabel(pin);
        } else {
          setPincodeShipping(null);
          setShippingPinLabel("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPincodeShipping(null);
          setShippingPinLabel("");
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
  const shippingResolved = shippingBase > 0 || (freeShippingMin > 0 && sub >= freeShippingMin) || pincodeShipping !== null;
  const effectiveBase = pincodeShipping !== null ? pincodeShipping : shippingBase;
  const qualifiesFreeShipping = freeShippingMin > 0 && sub >= freeShippingMin;
  const shipping = qualifiesFreeShipping ? 0 : effectiveBase;
  const gstAmount = gstPercent > 0 ? Math.round((sub * gstPercent) / 100) : 0;
  const discountAmount = appliedCoupon ? Math.round((sub * appliedCoupon.percentage) / 100) : 0;

  // CoreCoins discount calculation
  const minRedeem = Number(corecoinsConfig?.min_redeem || 0);
  const coinValueInr = Number(corecoinsConfig?.coin_value_inr || 1);
  const canUseCoins = corecoinsEnabled && corecoinsConfig && coinBalance >= minRedeem;
  const preCoinsTotal = Math.max(0, sub + shipping + gstAmount - discountAmount);
  const coinsDiscount = (useCoins && canUseCoins) ? Math.min(Math.floor(coinBalance * coinValueInr), preCoinsTotal) : 0;
  const coinsUsed = coinValueInr > 0 ? Math.ceil(coinsDiscount / coinValueInr) : 0;
  const total = Math.max(0, preCoinsTotal - coinsDiscount);
  const amountToFreeShipping = freeShippingMin > 0 && !qualifiesFreeShipping ? freeShippingMin - sub : 0;

  // Coupon apply handler — fetches fresh from DB to ensure latest codes
  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    setCouponError("");
    if (!code) { setCouponError("Enter a coupon code"); return; }
    setValidatingCoupon(true);
    try {
      const { data } = await supabase.from("app_settings").select("value")
        .eq("key", "discount_codes").maybeSingle();
      const codes = Array.isArray(data?.value) ? data.value : [];
      const found = codes.find(c => c.code === code && c.active);
      if (!found) { setCouponError("Invalid or expired coupon code"); setValidatingCoupon(false); return; }

      // Check schedule
      const now = new Date();
      if (found.startsAt && new Date(found.startsAt) > now) {
        setCouponError("This coupon is not active yet");
        setValidatingCoupon(false);
        return;
      }
      if (found.endsAt && new Date(found.endsAt) < now) {
        setCouponError("This coupon has expired");
        setValidatingCoupon(false);
        return;
      }

      // Check email restriction
      if (found.emails?.length > 0) {
        const userEmail = (user?.email || "").toLowerCase();
        if (!found.emails.map(e => e.toLowerCase()).includes(userEmail)) {
          setCouponError("This coupon is not available for your account");
          setValidatingCoupon(false);
          return;
        }
      }

      // Check new-users-only restriction
      if (found.newUsersOnly) {
        const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        if (count > 0) {
          setCouponError("This coupon is only for first-time customers");
          setValidatingCoupon(false);
          return;
        }
      }

      setAppliedCoupon({ code: found.code, percentage: found.percentage });
      sessionStorage.setItem("coreatoms_coupon", JSON.stringify({ code: found.code, percentage: found.percentage }));
      setCouponInput("");
      showToast(`Coupon "${found.code}" applied — ${found.percentage}% off!`, "success");
    } catch {
      setCouponError("Failed to validate coupon. Try again.");
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
  const canPlace =
    !!user &&
    totalItems > 0 &&
    isValidAddress(activeAddress) &&
    shippingResolved &&     // must have a confirmed shipping rate
    !shippingLoading;       // not currently fetching

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
        discountAmount,
        coupon: appliedCoupon ? { code: appliedCoupon.code, percentage: appliedCoupon.percentage } : null,
        coinsUsed,
        coinsDiscount,
        total,
        paymentMethod: 'cod',
      });
      setPlaced(true);
      setTimeout(() => { clear(); navigate("/orders"); }, 5000);
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
                } catch (_) { /* ignore parse errors */ }
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
              discountAmount,
              coupon: appliedCoupon ? { code: appliedCoupon.code, percentage: appliedCoupon.percentage } : null,
              coinsUsed,
              coinsDiscount,
              total,
              paymentMethod: 'prepaid',
              razorpayPaymentId: response.razorpay_payment_id,
            });
            setPlaced(true);
            setTimeout(() => { clear(); navigate("/orders"); }, 5000);
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
                  <span className="font-medium text-stone-900 ml-2">₹{(it.unitPrice * it.qty).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {/* Totals breakdown */}
            <div className="border-t border-dashed border-[#E8E4DE] mx-5" />
            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Items subtotal</span>
                <span className="text-stone-800">₹{r.itemsTotal.toLocaleString('en-IN')}</span>
              </div>
              {r.shipping > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Shipping</span>
                  <span className="text-stone-800">₹{r.shipping.toLocaleString('en-IN')}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
              )}
              {r.gstAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">GST ({r.gstPercent}%)</span>
                  <span className="text-stone-800">₹{r.gstAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {r.coupon && r.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 flex items-center gap-1">
                    🎉 Coupon <span className="font-mono font-bold">{r.coupon.code}</span> ({r.coupon.percentage}% off)
                  </span>
                  <span className="text-emerald-700 font-medium">−₹{r.discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              {r.coinsUsed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" /></svg>
                    CoreCoins ({r.coinsUsed} coins)
                  </span>
                  <span className="text-amber-700 font-medium">−₹{r.coinsDiscount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t border-[#E8E4DE] pt-2 flex justify-between">
                <span className="font-semibold text-stone-800">Total Paid</span>
                <span className="text-lg font-bold text-stone-900">₹{r.total.toLocaleString('en-IN')}</span>
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

          {/* Redirect note */}
          <p className="text-center text-xs text-stone-400">Redirecting to My Orders in a few seconds…</p>
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
                  {/* Edit & Delete buttons */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => startEditAddress(addr)}
                      className="text-xs text-stone-400 hover:text-[#1e3a5f] transition-colors" title="Edit address">✎</button>
                    {pendingDeleteId === addr.id ? (
                      <>
                        <button type="button" onClick={() => confirmDeleteAddress(addr.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">Remove</button>
                        <button type="button" onClick={() => setPendingDeleteId(null)}
                          className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setPendingDeleteId(addr.id)}
                        className="text-xs text-stone-300 hover:text-red-400 transition-colors" title="Delete address">✕</button>
                    )}
                  </div>
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

          {/* Address form — shown for new address OR when editing */}
          {(selectedAddressId === null || savedAddresses.length === 0 || editingAddressId) && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  {editingAddressId ? "Edit address" : savedAddresses.length > 0 ? "New address" : ""}
                </p>
                {editingAddressId && (
                  <button type="button" onClick={() => { setEditingAddressId(null); selectSavedAddress(savedAddresses.find(a => a.id === editingAddressId)); }}
                    className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Cancel editing</button>
                )}
              </div>

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
                  {savingAddress ? "Saving…" : addressSaved ? "Saved ✓" : editingAddressId ? "Update address" : "Save address"}
                </button>
                {addressSaved && <span className="text-xs text-emerald-600">{editingAddressId ? "Address updated" : "Address saved for future orders"}</span>}
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
                <div className="flex justify-between text-stone-600">
                  <span>GST ({gstPercent}%)</span>
                  <span className="font-semibold text-stone-900">{money(gstAmount)}</span>
                </div>
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
