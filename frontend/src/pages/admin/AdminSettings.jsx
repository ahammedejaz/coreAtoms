/**
 * AdminSettings.jsx — Admin settings and feature toggles.
 *
 * Manages application-wide settings stored in the `app_settings` table:
 *   • Feature toggles — COD, Razorpay, Replacements (enable/disable)
 *   • Shipping amount — flat shipping fee in INR
 *   • Max order items — per-cart item limit
 *   • Discount codes — with optional schedule (startsAt/endsAt) and
 *     email-restricted coupons
 *   • Warehouse address — used by Delhivery for pickup/shipment origin
 *
 * All settings auto-save on change. Ctrl+S is supported as a save shortcut.
 *
 * @module pages/admin/AdminSettings
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";

export default function AdminSettings() {
    const { showToast } = useToast();
    const [maxItems, setMaxItems] = useState(15);
    const [shippingAmount, setShippingAmount] = useState(0);
    const [saving, setSaving] = useState(false);

    // Razorpay toggle
    const [razorpayEnabled, setRazorpayEnabled] = useState(false);
    const [razorpayLoading, setRazorpayLoading] = useState(true);
    const [razorpaySaving, setRazorpaySaving] = useState(false);

    // COD toggle
    const [codEnabled, setCodEnabled] = useState(true);
    const [codLoading, setCodLoading] = useState(true);
    const [codSaving, setCodSaving] = useState(false);

    // Replacements toggle
    const [replacementsEnabled, setReplacementsEnabled] = useState(false);
    const [replacementsLoading, setReplacementsLoading] = useState(true);
    const [replacementsSaving, setReplacementsSaving] = useState(false);

    // Warehouse address
    const [warehouse, setWarehouse] = useState({ name: "", phone: "", address: "", city: "", state: "", pin: "" });
    const [warehouseLoading, setWarehouseLoading] = useState(true);
    const [warehouseSaving, setWarehouseSaving] = useState(false);

    // Discount codes
    const [discountCodes, setDiscountCodes] = useState([]);
    const [discountLoading, setDiscountLoading] = useState(true);
    const [newCode, setNewCode] = useState("");
    const [newPercent, setNewPercent] = useState("");
    const [newStartsAt, setNewStartsAt] = useState("");
    const [newEndsAt, setNewEndsAt] = useState("");
    const [newEmails, setNewEmails] = useState("");
    const [addingCode, setAddingCode] = useState(false);

    useEffect(() => {
        supabase.from("app_settings").select("value")
            .eq("key", "max_items_per_order").maybeSingle()
            .then(({ data }) => {
                const n = Number(data?.value?.n);
                if (Number.isFinite(n) && n > 0) setMaxItems(n);
            });

        supabase.from("app_settings").select("value")
            .eq("key", "shipping_amount").maybeSingle()
            .then(({ data }) => {
                const n = Number(data?.value?.amount);
                if (Number.isFinite(n) && n >= 0) setShippingAmount(n);
            });

        // Load Razorpay toggle
        supabase.from("app_settings").select("value")
            .eq("key", "razorpay_enabled").maybeSingle()
            .then(({ data }) => {
                setRazorpayEnabled(data?.value?.enabled === true);
                setRazorpayLoading(false);
            });

        // Load COD toggle (defaults to true if not set)
        supabase.from("app_settings").select("value")
            .eq("key", "cod_enabled").maybeSingle()
            .then(({ data }) => {
                setCodEnabled(data?.value?.enabled !== false);
                setCodLoading(false);
            });

        // Load replacements toggle
        supabase.from("app_settings").select("value")
            .eq("key", "replacements_enabled").maybeSingle()
            .then(({ data }) => {
                setReplacementsEnabled(data?.value?.enabled === true);
                setReplacementsLoading(false);
            });

        // Load warehouse address
        supabase.from("app_settings").select("value")
            .eq("key", "warehouse_address").maybeSingle()
            .then(({ data }) => {
                if (data?.value && typeof data.value === "object") {
                    setWarehouse(prev => ({ ...prev, ...data.value }));
                }
                setWarehouseLoading(false);
            });

        // Load discount codes
        supabase.from("app_settings").select("value")
            .eq("key", "discount_codes").maybeSingle()
            .then(({ data }) => {
                setDiscountCodes(Array.isArray(data?.value) ? data.value : []);
                setDiscountLoading(false);
            });
    }, []);

    const save = async () => {
        setSaving(true);
        const n = Number(maxItems);
        if (!Number.isFinite(n) || n <= 0) {
            showToast("Enter a valid number > 0", "error");
            setSaving(false);
            return;
        }
        const shipAmt = Number(shippingAmount);
        if (!Number.isFinite(shipAmt) || shipAmt < 0) {
            showToast("Shipping amount must be 0 or more", "error");
            setSaving(false);
            return;
        }
        const results = await Promise.all([
            supabase.from("app_settings").upsert({ key: "max_items_per_order", value: { n } }, { onConflict: "key" }),
            supabase.from("app_settings").upsert({ key: "shipping_amount", value: { amount: shipAmt } }, { onConflict: "key" }),
        ]);
        const err = results.find(r => r.error);
        if (err) {
            showToast(err.error.message, "error");
        } else {
            showToast("Settings saved", "success");
        }
        setSaving(false);
    };

    const toggleRazorpay = async () => {
        setRazorpaySaving(true);
        const newVal = !razorpayEnabled;
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "razorpay_enabled", value: { enabled: newVal } }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            setRazorpayEnabled(newVal);
            showToast(newVal ? "Razorpay payments enabled" : "Razorpay payments disabled", "success");
        }
        setRazorpaySaving(false);
    };

    const toggleCod = async () => {
        setCodSaving(true);
        const newVal = !codEnabled;
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "cod_enabled", value: { enabled: newVal } }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            setCodEnabled(newVal);
            showToast(newVal ? "Cash on Delivery enabled" : "Cash on Delivery disabled", "success");
        }
        setCodSaving(false);
    };

    const toggleReplacements = async () => {
        setReplacementsSaving(true);
        const newVal = !replacementsEnabled;
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "replacements_enabled", value: { enabled: newVal } }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            setReplacementsEnabled(newVal);
            showToast(newVal ? "Replacements enabled" : "Replacements disabled", "success");
        }
        setReplacementsSaving(false);
    };

    const saveWarehouse = async () => {
        const w = warehouse;
        if (!w.name || !w.phone || !w.address || !w.city || !w.state || !w.pin) {
            showToast("All warehouse fields are required", "error");
            return;
        }
        if (!/^\d{6}$/.test(w.pin)) {
            showToast("Pincode must be 6 digits", "error");
            return;
        }
        setWarehouseSaving(true);
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "warehouse_address", value: w }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            showToast("Warehouse address saved", "success");
        }
        setWarehouseSaving(false);
    };

    // ── Discount code helpers ──
    const saveDiscountCodes = async (codes) => {
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "discount_codes", value: codes }, { onConflict: "key" });
        if (error) { showToast(error.message, "error"); return false; }
        setDiscountCodes(codes);
        return true;
    };

    const addDiscountCode = async () => {
        const code = newCode.trim().toUpperCase();
        const pct = Number(newPercent);
        if (!code) { showToast("Enter a code", "error"); return; }
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) { showToast("Percentage must be 1–100", "error"); return; }
        if (discountCodes.some(c => c.code === code)) { showToast("Code already exists", "error"); return; }
        if (newStartsAt && newEndsAt && newStartsAt >= newEndsAt) { showToast("End date must be after start date", "error"); return; }
        setAddingCode(true);
        const entry = { code, percentage: pct, active: true };
        if (newStartsAt) entry.startsAt = newStartsAt;
        if (newEndsAt) entry.endsAt = newEndsAt;
        const emailList = newEmails.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
        if (emailList.length > 0) entry.emails = emailList;
        const ok = await saveDiscountCodes([...discountCodes, entry]);
        if (ok) { setNewCode(""); setNewPercent(""); setNewStartsAt(""); setNewEndsAt(""); setNewEmails(""); showToast(`Code "${code}" added`, "success"); }
        setAddingCode(false);
    };

    const toggleDiscountCode = async (code) => {
        const updated = discountCodes.map(c => c.code === code ? { ...c, active: !c.active } : c);
        const ok = await saveDiscountCodes(updated);
        if (ok) showToast(`Code "${code}" ${updated.find(c => c.code === code).active ? "activated" : "deactivated"}`, "success");
    };

    const deleteDiscountCode = async (code) => {
        const ok = await saveDiscountCodes(discountCodes.filter(c => c.code !== code));
        if (ok) showToast(`Code "${code}" deleted`, "info");
    };

    // Ctrl+S to save
    const saveRef = useRef(save);
    saveRef.current = save;
    const handleCtrlS = useCallback((e) => { e.preventDefault(); saveRef.current(); }, []);
    useKeyboardShortcut("ctrl+s", handleCtrlS);

    return (
        <div className="max-w-2xl space-y-6">
            {/* ── Order Settings ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                <div className="text-base font-semibold text-stone-900">Order settings</div>
                <div className="mt-2 text-sm text-stone-500">
                    Set the max number of total items allowed per order.
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                        <div className="text-xs text-stone-400">Max items per order</div>
                        <input type="number" value={maxItems} onChange={(e) => setMaxItems(e.target.value)} min={1}
                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                    </div>
                    <div>
                        <div className="text-xs text-stone-400">Shipping amount (₹)</div>
                        <input type="number" value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} min={0}
                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        <p className="text-[11px] text-stone-400 mt-1">Set to 0 for free shipping</p>
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving ? "Saving..." : "Save"}
                    </button>
                    <span className="text-xs text-stone-400">Ctrl+S</span>
                </div>
            </div>

            {/* ── Payment Methods ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                <div className="text-base font-semibold text-stone-900 mb-1">Payment Methods</div>
                <div className="text-sm text-stone-500 mb-5">Control which payment options are available to customers at checkout.</div>

                {/* COD Toggle */}
                <div className="rounded-xl border border-[#E8E4DE] p-4 mb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                Cash on Delivery
                                <span className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                    codEnabled
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-stone-100 text-stone-400",
                                ].join(" ")}>
                                    {codLoading ? "..." : codEnabled ? "Active" : "Inactive"}
                                </span>
                            </div>
                            <div className="mt-0.5 text-xs text-stone-500">
                                Allow customers to pay at the time of delivery.
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={codEnabled}
                            disabled={codLoading || codSaving}
                            onClick={toggleCod}
                            className={[
                                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                codEnabled ? "bg-emerald-500" : "bg-stone-300",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out",
                                    codEnabled ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                </div>

                {/* Razorpay Toggle */}
                <div className="rounded-xl border border-[#E8E4DE] p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                Razorpay (Online)
                                <span className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                    razorpayEnabled
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-stone-100 text-stone-400",
                                ].join(" ")}>
                                    {razorpayLoading ? "..." : razorpayEnabled ? "Active" : "Inactive"}
                                </span>
                            </div>
                            <div className="mt-0.5 text-xs text-stone-500">
                                Accept online payments via UPI, cards, and net banking.
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={razorpayEnabled}
                            disabled={razorpayLoading || razorpaySaving}
                            onClick={toggleRazorpay}
                            className={[
                                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                razorpayEnabled ? "bg-emerald-500" : "bg-stone-300",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out",
                                    razorpayEnabled ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                </div>

                {/* Info panel */}
                <div className={[
                    "mt-4 rounded-xl border p-4 text-xs leading-relaxed transition-all",
                    razorpayEnabled
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                        : "border-[#E8E4DE] bg-stone-50 text-stone-500",
                ].join(" ")}>
                    {razorpayEnabled ? (
                        <>
                            <div className="font-semibold mb-1">Razorpay payments are active</div>
                            <p>Customers will see both <strong>Cash on Delivery</strong> and <strong>Pay Now (Online)</strong> options during checkout.</p>
                            <p className="mt-2 text-emerald-600">Make sure your Razorpay API keys are configured in the environment variables.</p>
                        </>
                    ) : (
                        <>
                            <div className="font-semibold mb-1">Razorpay payments are disabled</div>
                            <p>Only <strong>Cash on Delivery</strong> is available at checkout. Toggle this on to enable online payments via Razorpay.</p>
                        </>
                    )}
                </div>

                {/* Setup instructions (collapsed) */}
                <details className="mt-3 rounded-xl border border-[#E8E4DE] bg-stone-50/50">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors">
                        Setup instructions
                    </summary>
                    <div className="px-4 pb-4 text-xs text-stone-500 space-y-2 leading-relaxed">
                        <p>To enable Razorpay, add these environment variables:</p>
                        <div className="rounded-lg bg-stone-900 text-stone-100 p-3 font-mono text-[11px] space-y-1">
                            <div><span className="text-stone-400"># Frontend .env file</span></div>
                            <div>VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx</div>
                            <div></div>
                            <div><span className="text-stone-400"># Supabase Edge Function secrets</span></div>
                            <div>RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx</div>
                            <div>RAZORPAY_KEY_SECRET=your_key_secret_here</div>
                        </div>
                        <p className="text-stone-400">Get your API keys from the <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">Razorpay Dashboard</a>.</p>
                    </div>
                </details>
            </div>

            {/* ── Replacements ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                <div className="text-base font-semibold text-stone-900 mb-1">Replacements</div>
                <div className="text-sm text-stone-500 mb-5">Allow customers to request product replacements for damaged shipments.</div>

                <div className="rounded-xl border border-[#E8E4DE] p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                Product Replacements
                                <span className={[
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                    replacementsEnabled
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-stone-100 text-stone-400",
                                ].join(" ")}>
                                    {replacementsLoading ? "..." : replacementsEnabled ? "Active" : "Inactive"}
                                </span>
                            </div>
                            <div className="mt-0.5 text-xs text-stone-500">
                                Customers can request replacements for damaged products by uploading photos.
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={replacementsEnabled}
                            disabled={replacementsLoading || replacementsSaving}
                            onClick={toggleReplacements}
                            className={[
                                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                replacementsEnabled ? "bg-emerald-500" : "bg-stone-300",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out",
                                    replacementsEnabled ? "translate-x-6" : "translate-x-1",
                                ].join(" ")}
                            />
                        </button>
                    </div>
                </div>

                {/* Warehouse / Return Address */}
                {replacementsEnabled && (
                    <div className="mt-4 rounded-xl border border-[#E8E4DE] p-4">
                        <div className="text-sm font-semibold text-stone-900 mb-0.5">Warehouse / Return Address</div>
                        <div className="text-xs text-stone-500 mb-4">
                            Used for reverse pickups and replacement shipments via Delhivery.
                        </div>

                        {warehouseLoading ? (
                            <div className="text-sm text-stone-400 py-2 text-center animate-pulse">Loading…</div>
                        ) : (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Contact Name</label>
                                        <input
                                            value={warehouse.name}
                                            onChange={e => setWarehouse(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Warehouse Manager"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Phone</label>
                                        <input
                                            value={warehouse.phone}
                                            onChange={e => setWarehouse(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="9876543210"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="text-xs text-stone-400 block mb-1">Street Address</label>
                                    <input
                                        value={warehouse.address}
                                        onChange={e => setWarehouse(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="123 Industrial Area, Sector 5"
                                        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                    />
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">City</label>
                                        <input
                                            value={warehouse.city}
                                            onChange={e => setWarehouse(prev => ({ ...prev, city: e.target.value }))}
                                            placeholder="Mumbai"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">State</label>
                                        <input
                                            value={warehouse.state}
                                            onChange={e => setWarehouse(prev => ({ ...prev, state: e.target.value }))}
                                            placeholder="Maharashtra"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Pincode</label>
                                        <input
                                            value={warehouse.pin}
                                            onChange={e => setWarehouse(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                            placeholder="400001"
                                            maxLength={6}
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={saveWarehouse}
                                        disabled={warehouseSaving}
                                        className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50"
                                    >
                                        {warehouseSaving ? "Saving…" : "Save Warehouse Address"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Discount Codes ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                <div className="text-base font-semibold text-stone-900 mb-1">Discount Codes</div>
                <div className="text-sm text-stone-500 mb-5">Create coupon codes with percentage discounts. Customers can apply these during checkout.</div>

                {/* Add new code */}
                <div className="rounded-xl border border-[#E8E4DE] p-4 mb-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Add new code</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <label className="text-xs text-stone-400 block mb-1">Code</label>
                            <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                                placeholder="e.g. SAVE20" maxLength={20}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono text-stone-900 uppercase placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                        <div className="w-full sm:w-28">
                            <label className="text-xs text-stone-400 block mb-1">Discount %</label>
                            <input type="number" value={newPercent} onChange={(e) => setNewPercent(e.target.value)}
                                placeholder="e.g. 20" min={1} max={100}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs text-stone-400 block mb-1">Starts at <span className="text-stone-300">(optional)</span></label>
                            <input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-stone-400 block mb-1">Ends at <span className="text-stone-300">(optional)</span></label>
                            <input type="datetime-local" value={newEndsAt} onChange={(e) => setNewEndsAt(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <label className="text-xs text-stone-400 block mb-1">Restrict to emails <span className="text-stone-300">(optional, comma-separated)</span></label>
                        <input value={newEmails} onChange={(e) => setNewEmails(e.target.value)}
                            placeholder="user1@example.com, user2@example.com"
                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                    </div>
                    <div className="mt-3">
                        <button onClick={addDiscountCode} disabled={addingCode || !newCode.trim() || !newPercent}
                            className="btn-primary py-2.5 px-5 text-sm whitespace-nowrap disabled:opacity-40">
                            {addingCode ? "Adding…" : "Add code"}
                        </button>
                    </div>
                </div>

                {/* Existing codes */}
                {discountLoading ? (
                    <div className="text-sm text-stone-400 py-4 text-center">Loading codes…</div>
                ) : discountCodes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E8E4DE] p-6 text-center">
                        <p className="text-sm text-stone-400">No discount codes yet. Add one above.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {discountCodes.map((dc) => (
                            <div key={dc.code} className="rounded-xl border border-[#E8E4DE] px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                                        <span className="font-mono text-sm font-semibold text-stone-900">{dc.code}</span>
                                        <span className="rounded-full bg-[#1e3a5f]/10 px-2 py-0.5 text-[11px] font-bold text-[#1e3a5f]">{dc.percentage}% off</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${dc.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"}`}>
                                            {dc.active ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button type="button" onClick={() => toggleDiscountCode(dc.code)}
                                            className="text-xs text-stone-400 hover:text-[#1e3a5f] transition-colors">
                                            {dc.active ? "Deactivate" : "Activate"}
                                        </button>
                                        <button type="button" onClick={() => deleteDiscountCode(dc.code)}
                                            className="text-xs text-stone-300 hover:text-red-500 transition-colors">✕</button>
                                    </div>
                                </div>
                                {(dc.startsAt || dc.endsAt || dc.emails?.length > 0) && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {dc.startsAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                                🕐 From {new Date(dc.startsAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        )}
                                        {dc.endsAt && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                                ⏳ Until {new Date(dc.endsAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        )}
                                        {dc.emails?.length > 0 && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                                                ✉ {dc.emails.length === 1 ? dc.emails[0] : `${dc.emails.length} emails`}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
