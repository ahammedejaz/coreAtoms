/**
 * AdminSettings.jsx — Admin settings panel with accordion sections.
 *
 * All settings are persisted to the `app_settings` Supabase table.
 * The UI is organised as collapsible accordion sections:
 *
 *  │ Shipping & Tax
 *  ├─ Flat shipping rate (INR). 0 = use Delhivery per-pincode rate.
 *  ├─ Free shipping threshold (INR). 0 = disabled.
 *  └─ GST percentage. 0 = GST disabled (hides 'Excl. GST' labels on product cards).
 *
 *  │ Payments
 *  ├─ Razorpay toggle (shows/hides online payment option at checkout)
 *  └─ COD toggle (shows/hides cash-on-delivery option at checkout)
 *
 *  │ Discount Codes
 *  └─ Add/remove coupon codes: percentage, date range, active flag
 *
 *  │ CoreCoins
 *  └─ Enable loyalty programme + configure earn_rate, earn_per_rupees,
 *       coin_value_inr, min_redeem
 *
 *  │ Replacements
 *  └─ Enable replacement system + configure replacement window in days
 *
 *  │ Promo Banner
 *  └─ Floating announcement bar: text, link, colours
 *
 * @module pages/admin/AdminSettings
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";

/** Every app_settings key this panel owns — read in one query so one error check covers all of them. */
const SETTING_KEYS = [
    "max_items_per_order", "shipping_amount", "free_shipping_min", "gst_percentage",
    "razorpay_enabled", "cod_enabled", "replacements_enabled", "warehouse_address",
    "discount_codes", "corecoins_enabled", "corecoins_config", "promo_banner",
];

/** Accordion chevron — rotates when its section is open. */
function Chevron({ open }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-stone-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

export default function AdminSettings({ isActive = true }) {
    const { showToast } = useToast();
    // Every field below starts at a hardcoded default. If the read fails those
    // defaults must never reach a save, or they overwrite the live config.
    const [loaded, setLoaded] = useState(false);
    const [loadErr, setLoadErr] = useState("");
    const [confirmDlg, setConfirmDlg] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
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
    const [replacementWindowDays, setReplacementWindowDays] = useState(1);
    const [replacementWindowMinutes, setReplacementWindowMinutes] = useState(0);

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
    const [newUsersOnly, setNewUsersOnly] = useState(false);
    const [addingCode, setAddingCode] = useState(false);

    // CoreCoins loyalty program
    const [corecoinsEnabled, setCorecoinsEnabled] = useState(false);
    const [corecoinsLoading, setCorecoinsLoading] = useState(true);
    const [corecoinsSaving, setCorecoinsSaving] = useState(false);
    const [corecoinsConfig, setCorecoinsConfig] = useState({
        earn_rate: 1,         // coins earned per threshold
        earn_per_rupees: 100, // threshold in ₹
        min_redeem: 100,      // minimum coins to redeem
        coin_value_inr: 1,    // value of 1 coin in ₹
    });

    // Promo banner
    const [bannerEnabled, setBannerEnabled] = useState(false);
    const [bannerImageUrl, setBannerImageUrl] = useState("");
    const [bannerLoading, setBannerLoading] = useState(true);
    const [bannerSaving, setBannerSaving] = useState(false);
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState("");

    const loadSettings = async () => {
        setLoadErr("");
        const { data, error } = await supabase
            .from("app_settings")
            .select("key,value")
            .in("key", SETTING_KEYS);

        // Mark the section spinners done either way, so a failure is visible
        // rather than looking like a permanent load.
        const finishSpinners = () => {
            setRazorpayLoading(false);
            setCodLoading(false);
            setReplacementsLoading(false);
            setWarehouseLoading(false);
            setDiscountLoading(false);
            setCorecoinsLoading(false);
            setBannerLoading(false);
        };

        if (error) {
            // Leave every field at its default but refuse to save — publishing
            // those defaults would wipe the live configuration.
            setLoaded(false);
            setLoadErr(error.message);
            finishSpinners();
            return;
        }

        const map = {};
        (data || []).forEach((row) => { map[row.key] = row.value; });

        const maxN = Number(map.max_items_per_order?.n);
        if (Number.isFinite(maxN) && maxN > 0) setMaxItems(maxN);

        const shipN = Number(map.shipping_amount?.amount);
        if (Number.isFinite(shipN) && shipN >= 0) setShippingAmount(shipN);

        const freeN = Number(map.free_shipping_min?.amount);
        if (Number.isFinite(freeN) && freeN >= 0) setFreeShippingMin(freeN);

        const gstN = Number(map.gst_percentage?.percentage);
        if (Number.isFinite(gstN) && gstN >= 0) setGstPercent(gstN);

        setRazorpayEnabled(map.razorpay_enabled?.enabled === true);
        // COD defaults to true if the row is missing
        setCodEnabled(map.cod_enabled?.enabled !== false);

        setReplacementsEnabled(map.replacements_enabled?.enabled === true);
        if (map.replacements_enabled?.window_days) setReplacementWindowDays(map.replacements_enabled.window_days);
        if (map.replacements_enabled?.window_minutes) setReplacementWindowMinutes(map.replacements_enabled.window_minutes);

        if (map.warehouse_address && typeof map.warehouse_address === "object") {
            setWarehouse(prev => ({ ...prev, ...map.warehouse_address }));
        }

        setDiscountCodes(Array.isArray(map.discount_codes) ? map.discount_codes : []);

        setCorecoinsEnabled(map.corecoins_enabled?.enabled === true);
        if (map.corecoins_config && typeof map.corecoins_config === "object") {
            setCorecoinsConfig(prev => ({ ...prev, ...map.corecoins_config }));
        }

        if (map.promo_banner) {
            setBannerEnabled(!!map.promo_banner.enabled);
            setBannerImageUrl(map.promo_banner.image_url || "");
        }

        finishSpinners();
        setLoaded(true);
    };

    useEffect(() => { loadSettings(); }, []); // eslint-disable-line

    /**
     * Guards every write. Returns true (and explains) when the settings have not
     * been read successfully, so no save can publish the hardcoded defaults.
     */
    const blockedByLoad = () => {
        if (loaded) return false;
        showToast(
            loadErr
                ? `Settings failed to load (${loadErr}) — reload before saving`
                : "Settings are still loading",
            "error"
        );
        return true;
    };

    const save = async () => {
        if (blockedByLoad()) return;
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
        if (blockedByLoad()) return;
        const newVal = !razorpayEnabled;
        if (!newVal && !codEnabled) {
            showToast("Cannot disable Razorpay — COD is also disabled. Enable at least one payment method.", "error");
            return;
        }
        setRazorpaySaving(true);
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
        if (blockedByLoad()) return;
        const newVal = !codEnabled;
        if (!newVal && !razorpayEnabled) {
            showToast("Cannot disable COD — Razorpay is also disabled. Enable at least one payment method.", "error");
            return;
        }
        setCodSaving(true);
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
        if (blockedByLoad()) return;
        setReplacementsSaving(true);
        const newVal = !replacementsEnabled;
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "replacements_enabled", value: { enabled: newVal, window_days: Number(replacementWindowDays) || 1, window_minutes: Number(replacementWindowMinutes) || 0 } }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            setReplacementsEnabled(newVal);
            showToast(newVal ? "Replacements enabled" : "Replacements disabled", "success");
        }
        setReplacementsSaving(false);
    };

    const saveReplacementWindowDays = async () => {
        if (blockedByLoad()) return;
        setReplacementsSaving(true);
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "replacements_enabled", value: { enabled: replacementsEnabled, window_days: Number(replacementWindowDays) || 1, window_minutes: Number(replacementWindowMinutes) || 0 } }, { onConflict: "key" });
        if (error) showToast(error.message, "error");
        else showToast("Replacement window saved", "success");
        setReplacementsSaving(false);
    };

    // ── CoreCoins helpers ──
    const toggleCorecoins = async () => {
        if (blockedByLoad()) return;
        setCorecoinsSaving(true);
        const newVal = !corecoinsEnabled;
        const { error } = await supabase.from("app_settings")
            .upsert({ key: "corecoins_enabled", value: { enabled: newVal } }, { onConflict: "key" });
        if (error) {
            showToast(error.message, "error");
        } else {
            setCorecoinsEnabled(newVal);
            showToast(newVal ? "CoreCoins program enabled" : "CoreCoins program disabled", "success");
        }
        setCorecoinsSaving(false);
    };

    const saveCorecoinsConfig = async () => {
        if (blockedByLoad()) return;
        const c = corecoinsConfig;
        const earnRate = Number(c.earn_rate);
        const earnPer = Number(c.earn_per_rupees);
        const minRedeem = Number(c.min_redeem);
        const coinVal = Number(c.coin_value_inr);
        if (!Number.isFinite(earnRate) || earnRate <= 0) { showToast("Earn rate must be > 0", "error"); return; }
        if (!Number.isFinite(earnPer) || earnPer <= 0) { showToast("Earn per ₹ must be > 0", "error"); return; }
        if (!Number.isFinite(minRedeem) || minRedeem <= 0) { showToast("Min redeem must be > 0", "error"); return; }
        if (!Number.isFinite(coinVal) || coinVal <= 0) { showToast("Coin value must be > 0", "error"); return; }
        setCorecoinsSaving(true);
        const { error } = await supabase.from("app_settings").upsert(
            { key: "corecoins_config", value: { earn_rate: earnRate, earn_per_rupees: earnPer, min_redeem: minRedeem, coin_value_inr: coinVal } },
            { onConflict: "key" }
        );
        if (error) showToast(error.message, "error");
        else showToast("CoreCoins settings saved", "success");
        setCorecoinsSaving(false);
    };

    const saveWarehouse = async () => {
        if (blockedByLoad()) return;
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
        if (blockedByLoad()) return false;
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
        if (newUsersOnly) entry.newUsersOnly = true;
        const ok = await saveDiscountCodes([...discountCodes, entry]);
        if (ok) { setNewCode(""); setNewPercent(""); setNewStartsAt(""); setNewEndsAt(""); setNewEmails(""); setNewUsersOnly(false); showToast(`Code "${code}" added`, "success"); }
        setAddingCode(false);
    };

    const deleteDiscountCode = (code) => {
        setConfirmDlg({
            title: "Delete discount code?",
            message: `"${code}" will stop working for every customer immediately. This cannot be undone.`,
            confirmLabel: "Delete code",
            variant: "danger",
            onConfirm: async () => {
                setConfirmBusy(true);
                const ok = await saveDiscountCodes(discountCodes.filter(c => c.code !== code));
                setConfirmBusy(false);
                setConfirmDlg(null);
                if (ok) showToast(`Code "${code}" deleted`, "info");
            },
        });
    };

    // Ctrl+S to save. Every admin tab stays mounted, so this must only fire
    // while Settings is the tab on screen.
    const saveRef = useRef(save);
    saveRef.current = save;
    const handleCtrlS = useCallback((e) => {
        if (!isActive) return;
        e.preventDefault();
        saveRef.current();
    }, [isActive]);
    useKeyboardShortcut("ctrl+s", handleCtrlS);

    // ── Promo Banner helpers ──
    const toggleBanner = async () => {
        if (blockedByLoad()) return;
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
        if (blockedByLoad()) return;
        setBannerSaving(true);
        let url = bannerImageUrl;

        // Upload the replacement first. Deleting the old object up front left
        // promo_banner.image_url pointing at a deleted file whenever the upload
        // failed — a live, broken banner.
        const previousUrl = bannerImageUrl;
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
            // Only now is the old object unreferenced — safe to remove.
            if (bannerFile && previousUrl && previousUrl !== url) {
                try {
                    const oldPath = previousUrl.split("/hero-images/")[1];
                    if (oldPath) await supabase.storage.from("hero-images").remove([oldPath]);
                } catch { /* ignore delete errors — the new banner is already live */ }
            }
            setBannerImageUrl(url);
            setBannerFile(null);
            setBannerPreview("");
            showToast("Banner saved", "success");
        }
        setBannerSaving(false);
    };

    return (
        <div className="max-w-2xl space-y-4">
            {/* Saving while the read failed would publish the hardcoded defaults
                over the live config, so every write is blocked until a retry. */}
            {loadErr && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <div className="text-sm font-semibold text-red-700">Settings failed to load</div>
                    <p className="mt-1 text-xs text-red-600">
                        {loadErr} — the values below are placeholders, so saving is disabled until the settings load.
                    </p>
                    <button
                        type="button"
                        onClick={loadSettings}
                        className="mt-3 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                    >
                        ↺ Retry
                    </button>
                </div>
            )}

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
                    <Chevron open={openSections.has("banner")} />
                </button>
                {openSections.has("banner") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-stone-700">Enable banner</span>
                            <button type="button" role="switch" aria-checked={bannerEnabled} disabled={!loaded || bannerLoading || bannerSaving} onClick={toggleBanner}
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
                                    <button type="button" onClick={saveBanner} disabled={!loaded || bannerSaving} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
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
                    <Chevron open={openSections.has("orders")} />
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
                            <button onClick={save} disabled={!loaded || saving} className="btn-primary disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
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
                    <Chevron open={openSections.has("payments")} />
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
                                <button type="button" role="switch" aria-checked={codEnabled} disabled={!loaded || codLoading || codSaving} onClick={toggleCod}
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
                                <button type="button" role="switch" aria-checked={razorpayEnabled} disabled={!loaded || razorpayLoading || razorpaySaving} onClick={toggleRazorpay}
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
                    <Chevron open={openSections.has("replacements")} />
                </button>
                {openSections.has("replacements") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-stone-700">Enable replacements</span>
                            <button type="button" role="switch" aria-checked={replacementsEnabled} disabled={!loaded || replacementsLoading || replacementsSaving} onClick={toggleReplacements}
                                className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                    replacementsEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                    replacementsEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                            </button>
                        </div>
                        {/* Replacement window duration */}
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-stone-400 mb-1">Replacement window (days)</label>
                                <input
                                    type="number" min={0} max={30}
                                    value={replacementWindowDays}
                                    onChange={(e) => setReplacementWindowDays(e.target.value)}
                                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <p className="text-[11px] text-stone-400 mt-1">Customers can request a replacement within this many days of delivery. CoreCoins are credited after this window closes.</p>
                            </div>
                            <button
                                type="button"
                                onClick={saveReplacementWindowDays}
                                disabled={!loaded || replacementsSaving}
                                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                        {/* Replacement window in minutes (overrides days when > 0) */}
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-stone-400 mb-1">Replacement window (minutes)</label>
                                <input
                                    type="number" min={0} max={1440}
                                    value={replacementWindowMinutes}
                                    onChange={(e) => setReplacementWindowMinutes(e.target.value)}
                                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <p className="text-[11px] text-stone-400 mt-1">When set to a value greater than 0, minutes are used instead of days. Set to 0 to use the days value above.</p>
                            </div>
                            <button
                                type="button"
                                onClick={saveReplacementWindowDays}
                                disabled={!loaded || replacementsSaving}
                                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── CoreCoins Loyalty Program ── */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white">
                <button type="button" onClick={() => toggleSection("corecoins")} className="w-full flex items-center justify-between p-5 text-left">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-semibold text-stone-900">CoreCoins Loyalty Program</div>
                            <span className={["text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                corecoinsEnabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-100 border-stone-200 text-stone-400"].join(" ")}>
                                {corecoinsLoading ? "..." : corecoinsEnabled ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">Reward customers with coins on purchases. Redeemable for discounts at checkout.</div>
                    </div>
                    <Chevron open={openSections.has("corecoins")} />
                </button>
                {openSections.has("corecoins") && (
                    <div className="px-5 pb-5 border-t border-[#E8E4DE] pt-4 space-y-5">
                        {/* Toggle */}
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-stone-700">Enable CoreCoins</span>
                            <button type="button" role="switch" aria-checked={corecoinsEnabled} disabled={!loaded || corecoinsLoading || corecoinsSaving} onClick={toggleCorecoins}
                                className={["relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                    corecoinsEnabled ? "bg-emerald-500" : "bg-stone-300"].join(" ")}>
                                <span className={["inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
                                    corecoinsEnabled ? "translate-x-6" : "translate-x-1"].join(" ")} />
                            </button>
                        </div>

                        {/* Config fields */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <div className="text-xs text-stone-400">Coins earned per purchase</div>
                                <input type="number" value={corecoinsConfig.earn_rate}
                                    onChange={(e) => setCorecoinsConfig(p => ({ ...p, earn_rate: e.target.value }))} min={1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">Number of coins earned per threshold amount</p>
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">Per ₹ spent</div>
                                <input type="number" value={corecoinsConfig.earn_per_rupees}
                                    onChange={(e) => setCorecoinsConfig(p => ({ ...p, earn_per_rupees: e.target.value }))} min={1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">e.g. 1 coin per ₹100 spent</p>
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">Minimum coins to redeem</div>
                                <input type="number" value={corecoinsConfig.min_redeem}
                                    onChange={(e) => setCorecoinsConfig(p => ({ ...p, min_redeem: e.target.value }))} min={1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">Customer must have at least this many coins to use them</p>
                            </div>
                            <div>
                                <div className="text-xs text-stone-400">Value per coin (₹)</div>
                                <input type="number" value={corecoinsConfig.coin_value_inr}
                                    onChange={(e) => setCorecoinsConfig(p => ({ ...p, coin_value_inr: e.target.value }))} min={0.1} step={0.1}
                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                                <p className="text-[11px] text-stone-400 mt-1">How much ₹ each coin is worth when redeemed</p>
                            </div>
                        </div>

                        {/* Info card */}
                        <div className="rounded-xl bg-stone-50 border border-[#E8E4DE] px-4 py-3 text-xs text-stone-500 space-y-1">
                            <p className="font-semibold text-stone-600">How it works</p>
                            <p>• Coins are credited after delivery{replacementsEnabled ? " and the replacement window closes (1 day)" : ""}.</p>
                            <p>• With current settings: customer earns <strong className="text-stone-900">{corecoinsConfig.earn_rate} coin{Number(corecoinsConfig.earn_rate) !== 1 ? "s" : ""}</strong> for every <strong className="text-stone-900">₹{corecoinsConfig.earn_per_rupees}</strong> spent.</p>
                            <p>• Minimum <strong className="text-stone-900">{corecoinsConfig.min_redeem} coins</strong> required to redeem. Each coin = <strong className="text-stone-900">₹{corecoinsConfig.coin_value_inr}</strong>.</p>
                        </div>

                        <button type="button" onClick={saveCorecoinsConfig} disabled={!loaded || corecoinsSaving}
                            className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
                            {corecoinsSaving ? "Saving…" : "Save CoreCoins Settings"}
                        </button>
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
                    <Chevron open={openSections.has("warehouse")} />
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
                                    <button type="button" onClick={saveWarehouse} disabled={!loaded || warehouseSaving} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
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
                    <Chevron open={openSections.has("discounts")} />
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
                            <div className="mt-3 flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={newUsersOnly} onChange={(e) => setNewUsersOnly(e.target.checked)}
                                        className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500/30 h-4 w-4" />
                                    <span className="text-xs text-stone-600">New users only</span>
                                </label>
                            </div>
                            <button type="button" onClick={addDiscountCode} disabled={!loaded || addingCode} className="mt-3 btn-primary py-2 px-5 text-sm disabled:opacity-50">
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
                                                {dc.newUsersOnly && <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">🆕 New users</span>}
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

            {confirmDlg && (
                <ConfirmDialog
                    {...confirmDlg}
                    loading={confirmBusy}
                    onCancel={() => { if (!confirmBusy) setConfirmDlg(null); }}
                />
            )}
        </div>
    );
}

