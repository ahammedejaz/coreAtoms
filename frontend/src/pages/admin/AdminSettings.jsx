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
    const [freeShippingMin, setFreeShippingMin] = useState(500);
    const [gstPercent, setGstPercent] = useState(0);
    const [saving, setSaving] = useState(false);

    // Accordion state — tracks which sections are open
    const [openSections, setOpenSections] = useState(new Set());
    const toggleSection = (key) => setOpenSections(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });
    const Chevron = ({ section }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-stone-400 shrink-0 transition-transform duration-200 ${openSections.has(section) ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );

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

    // Promo banner
    const [bannerEnabled, setBannerEnabled] = useState(false);
    const [bannerImageUrl, setBannerImageUrl] = useState("");
    const [bannerLoading, setBannerLoading] = useState(true);
    const [bannerSaving, setBannerSaving] = useState(false);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState("");

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

        // Load promo banner
        supabase.from("app_settings").select("value")
            .eq("key", "promo_banner").maybeSingle()
            .then(({ data }) => {
                if (data?.value) {
                    setBannerEnabled(!!data.value.enabled);
                    setBannerImageUrl(data.value.image_url || "");
                }
                setBannerLoading(false);
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
        const freeMin = Number(freeShippingMin);
        if (!Number.isFinite(freeMin) || freeMin < 0) {
            showToast("Free shipping minimum must be 0 or more", "error");
            setSaving(false);
            return;
        }
        const gst = Number(gstPercent);
        if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
            showToast("GST % must be between 0 and 100", "error");
            setSaving(false);
            return;
        }
        const results = await Promise.all([
            supabase.from("app_settings").upsert({ key: "max_items_per_order", value: { n } }, { onConflict: "key" }),
            supabase.from("app_settings").upsert({ key: "shipping_amount", value: { amount: shipAmt } }, { onConflict: "key" }),
            supabase.from("app_settings").upsert({ key: "free_shipping_min", value: { amount: freeMin } }, { onConflict: "key" }),
            supabase.from("app_settings").upsert({ key: "gst_percentage", value: { percentage: gst } }, { onConflict: "key" }),
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

    // ── Promo Banner helpers ──
    const toggleBanner = async () => {
        setBannerSaving(true);
        const next = !bannerEnabled;
        const { error } = await supabase.from("app_settings").upsert(
            { key: "promo_banner", value: { enabled: next, image_url: bannerImageUrl } },
            { onConflict: "key" }
        );
        if (error) showToast(error.message, "error");
        else { setBannerEnabled(next); showToast(next ? "Banner activated" : "Banner deactivated", "success"); }
        setBannerSaving(false);
    };

    const handleBannerFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBannerFile(f);
        setBannerPreview(URL.createObjectURL(f));
    };

    const saveBanner = async () => {
        setBannerSaving(true);
        let url = bannerImageUrl;

        // Upload image if new file selected
        if (bannerFile) {
            const ext = bannerFile.name.split(".").pop();
            const path = `promo-banner/banner-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from("hero-images").upload(path, bannerFile, { cacheControl: "3600", upsert: true });
            if (upErr) { showToast(upErr.message, "error"); setBannerSaving(false); return; }
            const { data: pd } = supabase.storage.from("hero-images").getPublicUrl(path);
            url = pd.publicUrl;
        }

        const { error } = await supabase.from("app_settings").upsert(
            { key: "promo_banner", value: { enabled: bannerEnabled, image_url: url } },
            { onConflict: "key" }
        );
        if (error) showToast(error.message, "error");
        else {
            setBannerImageUrl(url);
            setBannerFile(null);
            setBannerPreview("");
            showToast("Banner saved", "success");
        }
        setBannerSaving(false);
    };

    return (
        <div className="max-w-2xl space-y-4">
            {/* ── Promo Banner ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("banner")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-stone-900">Promo Banner</div>
                            <span className={["text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                bannerEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-100 border-stone-200 text-stone-400"].join(" ")}>
                                {bannerLoading ? "..." : bannerEnabled ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">Show a promotional banner on the homepage for sales or events.</div>
                    </div>
                    <Chevron section="banner" />
                </button>
                {openSections.has("banner") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-stone-700">Enable banner</span>
                            <button type="button" role="switch" aria-checked={bannerEnabled} disabled={bannerLoading || bannerSaving} onClick={toggleBanner}
                                className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                    bannerEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                    bannerEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {(bannerPreview || bannerImageUrl) && (
                                <div className="rounded-xl overflow-hidden border border-[#E8E4DE]">
                                    <img src={bannerPreview || bannerImageUrl} alt="Banner preview" className="w-full h-auto object-cover" style={{ maxHeight: "200px" }} />
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                                    📷 {bannerImageUrl ? "Change Image" : "Upload Banner Image"}
                                    <input type="file" accept="image/*" onChange={handleBannerFile} className="hidden" />
                                </label>
                                {bannerFile && (
                                    <button type="button" onClick={saveBanner} disabled={bannerSaving} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
                                        {bannerSaving ? "Uploading…" : "Save Banner"}
                                    </button>
                                )}
                            </div>
                            {!bannerImageUrl && !bannerFile && (
                                <p className="text-[11px] text-stone-400">Upload an image to display in the banner. Recommended: 1200×400px or wider.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Order Settings ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("orders")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="text-base font-semibold text-stone-900">Order Settings</div>
                        <div className="mt-0.5 text-xs text-stone-500">Max items, shipping, free shipping threshold, GST.</div>
                    </div>
                    <Chevron section="orders" />
                </button>
                {openSections.has("orders") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <div className="text-xs text-stone-400">Max items per order</div>
                                <input type="number" value={maxItems} onChange={(e) => setMaxItems(e.target.value)} min={1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">Shipping amount (₹)</div>
                                <input type="number" value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} min={0}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">Flat shipping fee charged when applicable</p>
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">Free shipping above (₹)</div>
                                <input type="number" value={freeShippingMin} onChange={(e) => setFreeShippingMin(e.target.value)} min={0}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">Orders ≥ this amount get free shipping. Set to 0 to always charge shipping.</p>
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">GST %</div>
                                <input type="number" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} min={0} max={100} step={0.1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">Applied on subtotal. Set to 0 to disable GST.</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                            <span className="text-xs text-stone-400">Ctrl+S</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Payment Methods ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("payments")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="text-base font-semibold text-stone-900">Payment Methods</div>
                        <div className="mt-0.5 text-xs text-stone-500">Control which payment options are available at checkout.</div>
                    </div>
                    <Chevron section="payments" />
                </button>
                {openSections.has("payments") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="rounded-xl border border-[#E8E4DE] p-4 mb-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                        Cash on Delivery
                                        <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                            codEnabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"].join(" ")}>
                                            {codLoading ? "..." : codEnabled ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-xs text-stone-500">Allow customers to pay cash on delivery.</div>
                                </div>
                                <button type="button" role="switch" aria-checked={codEnabled} disabled={codLoading || codSaving} onClick={toggleCod}
                                    className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                        codEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                    <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                        codEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                                </button>
                            </div>
                        </div>
                        <div className="rounded-xl border border-[#E8E4DE] p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                                        Razorpay (Online Payments)
                                        <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                            razorpayEnabled ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"].join(" ")}>
                                            {razorpayLoading ? "..." : razorpayEnabled ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-xs text-stone-500">Accept UPI, cards, wallets, and net banking via Razorpay.</div>
                                </div>
                                <button type="button" role="switch" aria-checked={razorpayEnabled} disabled={razorpayLoading || razorpaySaving} onClick={toggleRazorpay}
                                    className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                        razorpayEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                    <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                        razorpayEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                                </button>
                            </div>
                            <div className="mt-3 rounded-lg bg-stone-50 border border-[#E8E4DE] px-3 py-2.5 text-xs text-stone-500">
                                {razorpayEnabled ? (
                                    <><div className="font-semibold text-emerald-700 mb-1">Razorpay is enabled ✓</div><p className="text-emerald-600">Make sure your Razorpay API keys are configured in the environment variables.</p></>
                                ) : (
                                    <><div className="font-semibold mb-1">Razorpay payments are disabled</div><p>Only <strong>Cash on Delivery</strong> is available at checkout.</p></>
                                )}
                            </div>
                            <details className="mt-3 rounded-xl border border-[#E8E4DE] bg-stone-50/50">
                                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors">Setup instructions</summary>
                                <div className="px-4 pb-4 text-xs text-stone-500 space-y-2 leading-relaxed">
                                    <p>To enable Razorpay, add these environment variables:</p>
                                    <div className="rounded-lg bg-stone-900 text-stone-100 p-3 font-mono text-[11px] space-y-1">
                                        <div><span className="text-stone-400"># Frontend .env file</span></div>
                                        <div>VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx</div>
                                        <div><span className="text-stone-400"># Supabase Edge Function secrets</span></div>
                                        <div>RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx</div>
                                        <div>RAZORPAY_KEY_SECRET=your_key_secret_here</div>
                                    </div>
                                    <p className="text-stone-400">Get your API keys from the <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">Razorpay Dashboard</a>.</p>
                                </div>
                            </details>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Replacements ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("replacements")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-stone-900">Replacements</div>
                            <span className={["text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                replacementsEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-100 border-stone-200 text-stone-400"].join(" ")}>
                                {replacementsLoading ? "..." : replacementsEnabled ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">Allow customers to request product replacements for damaged shipments.</div>
                    </div>
                    <Chevron section="replacements" />
                </button>
                {openSections.has("replacements") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-stone-700">Enable replacements</span>
                            <button type="button" role="switch" aria-checked={replacementsEnabled} disabled={replacementsLoading || replacementsSaving} onClick={toggleReplacements}
                                className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                    replacementsEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                    replacementsEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Warehouse / Return Address ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("warehouse")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="text-base font-semibold text-stone-900">Warehouse / Return Address</div>
                        <div className="mt-0.5 text-xs text-stone-500">Origin for Delhivery shipments, rate calculations, and return pickups.</div>
                    </div>
                    <Chevron section="warehouse" />
                </button>
                {openSections.has("warehouse") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        {warehouseLoading ? (
                            <div className="animate-pulse h-20 bg-stone-100 rounded-xl" />
                        ) : (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Contact name</label>
                                        <input value={warehouse.name} onChange={e => setWarehouse(prev => ({ ...prev, name: e.target.value }))} placeholder="John Doe"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Phone</label>
                                        <input value={warehouse.phone} onChange={e => setWarehouse(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="9876543210" maxLength={10}
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-xs text-stone-400 block mb-1">Address</label>
                                        <textarea value={warehouse.address} onChange={e => setWarehouse(prev => ({ ...prev, address: e.target.value }))} placeholder="123 Industrial Area, Sector 5" rows={2}
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">City</label>
                                        <input value={warehouse.city} onChange={e => setWarehouse(prev => ({ ...prev, city: e.target.value }))} placeholder="Mumbai"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">State</label>
                                        <input value={warehouse.state} onChange={e => setWarehouse(prev => ({ ...prev, state: e.target.value }))} placeholder="Maharashtra"
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-400 block mb-1">Pincode</label>
                                        <input value={warehouse.pin} onChange={e => setWarehouse(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="400001" maxLength={6}
                                            className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button type="button" onClick={saveWarehouse} disabled={warehouseSaving} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
                                        {warehouseSaving ? "Saving…" : "Save Warehouse Address"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Discount Codes ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("discounts")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="text-base font-semibold text-stone-900">Discount Codes</div>
                        <div className="mt-0.5 text-xs text-stone-500">Create coupon codes with percentage discounts for checkout.</div>
                    </div>
                    <Chevron section="discounts" />
                </button>
                {openSections.has("discounts") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="rounded-xl border border-[#E8E4DE] p-4 mb-4">
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Add new code</p>
                            {/* Row 1: Code + Discount % */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs text-stone-400 block mb-1">Code</label>
                                    <input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="SAVE20" maxLength={20}
                                        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm font-mono uppercase text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                </div>
                                <div className="w-28">
                                    <label className="text-xs text-stone-400 block mb-1">Discount %</label>
                                    <input type="number" value={newPercent} onChange={(e) => setNewPercent(e.target.value)} placeholder="20" min={1} max={100}
                                        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                </div>
                            </div>
                            {/* Row 2: Starts at + Ends at */}
                            <div className="mt-3 flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs text-stone-400 block mb-1">Starts at (optional)</label>
                                    <input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)}
                                        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-stone-400 block mb-1">Ends at (optional)</label>
                                    <input type="datetime-local" value={newEndsAt} onChange={(e) => setNewEndsAt(e.target.value)}
                                        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                </div>
                            </div>
                            {/* Row 3: Restrict to emails */}
                            <div className="mt-3">
                                <label className="text-xs text-stone-400 block mb-1">Restrict to emails (optional, comma-separated)</label>
                                <input value={newEmails} onChange={(e) => setNewEmails(e.target.value)} placeholder="user1@example.com, user2@example.com"
                                    className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                            </div>
                            <button type="button" onClick={addDiscountCode} disabled={addingCode} className="mt-3 btn-primary py-2 px-5 text-sm disabled:opacity-50">
                                {addingCode ? "Adding…" : "Add Code"}
                            </button>
                        </div>
                        {discountLoading ? (
                            <div className="text-sm text-stone-400 text-center py-4 animate-pulse">Loading codes…</div>
                        ) : discountCodes.length === 0 ? (
                            <div className="text-sm text-stone-400 text-center py-4">No discount codes yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {discountCodes.map((dc, i) => (
                                    <div key={i} className="rounded-xl border border-[#E8E4DE] px-4 py-3 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold text-stone-900">{dc.code}</span>
                                                <button type="button" title="Copy code"
                                                    onClick={(e) => { navigator.clipboard.writeText(dc.code); const btn = e.currentTarget; btn.textContent = "✓"; setTimeout(() => { btn.textContent = "📋"; }, 1200); }}
                                                    className="text-stone-400 hover:text-stone-700 text-sm transition-colors">📋</button>
                                                <span className="text-xs text-emerald-600 font-semibold">{dc.percentage}% off</span>
                                            </div>
                                            {(dc.startsAt || dc.endsAt || dc.emails?.length > 0) && (
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    {dc.startsAt && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">🕐 From {new Date(dc.startsAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                                                    {dc.endsAt && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">⏳ Until {new Date(dc.endsAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                                                    {dc.emails?.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">✉ {dc.emails.length === 1 ? dc.emails[0] : `${dc.emails.length} emails`}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => deleteDiscountCode(dc.code)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition-colors shrink-0">Remove</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

