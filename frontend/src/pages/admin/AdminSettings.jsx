import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";

export default function AdminSettings() {
    const { showToast } = useToast();
    const [maxItems, setMaxItems] = useState(15);
    const [saving, setSaving] = useState(false);

    // Razorpay toggle
    const [razorpayEnabled, setRazorpayEnabled] = useState(false);
    const [razorpayLoading, setRazorpayLoading] = useState(true);
    const [razorpaySaving, setRazorpaySaving] = useState(false);

    // COD toggle
    const [codEnabled, setCodEnabled] = useState(true);
    const [codLoading, setCodLoading] = useState(true);
    const [codSaving, setCodSaving] = useState(false);

    useEffect(() => {
        supabase.from("app_settings").select("value")
            .eq("key", "max_items_per_order").maybeSingle()
            .then(({ data }) => {
                const n = Number(data?.value?.n);
                if (Number.isFinite(n) && n > 0) setMaxItems(n);
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
    }, []);

    const save = async () => {
        setSaving(true);
        const n = Number(maxItems);
        if (!Number.isFinite(n) || n <= 0) {
            showToast("Enter a valid number > 0", "error");
            setSaving(false);
            return;
        }
        const { error } = await supabase.from("app_settings")
            .update({ value: { n } }).eq("key", "max_items_per_order");
        if (error) {
            showToast(error.message, "error");
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
                <div className="mt-4">
                    <div className="text-xs text-stone-400">Max items per order</div>
                    <input type="number" value={maxItems} onChange={(e) => setMaxItems(e.target.value)} min={1}
                        className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
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
        </div>
    );
}
