/**
 * PincodeChecker.jsx — Check delivery availability by pincode.
 *
 * Users enter their 6-digit pincode to see whether delivery is available,
 * the estimated delivery days, COD availability and the city name.
 * Persists the last checked pincode in localStorage for convenience.
 *
 * @module components/PincodeChecker
 */
import { useEffect, useState } from "react";
import { Check, CircleAlert, MapPin } from "lucide-react";
import { supabase } from "../services/supabase/client";

const LS_KEY = "coreatoms_pincode";

export default function PincodeChecker() {
    const [pincode, setPincode] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const checkPincode = async (code) => {
        const pin = code || pincode;
        if (!/^\d{6}$/.test(pin)) {
            setError("Enter a valid 6-digit pincode");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        try {
            const { data, error: fnErr } = await supabase.functions.invoke(
                "delhivery-pincode-check",
                { body: { pincode: pin } }
            );

            if (fnErr) {
                let detail = fnErr.message || "Check failed";
                if (fnErr.context && typeof fnErr.context.json === "function") {
                    try {
                        const errBody = await fnErr.context.json();
                        detail = errBody?.error || errBody?.message || detail;
                    } catch { /* ignore */ }
                }
                throw new Error(detail);
            }

            setResult(data);
            localStorage.setItem(LS_KEY, pin);
        } catch (err) {
            setError(err.message || "Failed to check pincode");
        } finally {
            setLoading(false);
        }
    };

    // Load a previously checked pincode on mount. Declared after checkPincode
    // so the effect does not reference it before it is initialised.
    useEffect(() => {
        const saved = localStorage.getItem(LS_KEY);
        if (saved && /^\d{6}$/.test(saved)) {
            setPincode(saved);
            checkPincode(saved);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === "Enter") checkPincode();
    };

    return (
        <div>
            <label htmlFor="pincode-check" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <MapPin className="h-4 w-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
                Check delivery to your pincode
            </label>

            <div className="mt-2.5 flex max-w-sm gap-2">
                <input
                    id="pincode-check"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPincode(val);
                        if (result) setResult(null);
                        if (error) setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="6-digit pincode"
                    aria-describedby="pincode-status"
                    className="h-11 flex-1 rounded-full border border-line-strong bg-white px-4 text-sm text-ink placeholder:text-stone-400 outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_4px_rgba(30,58,95,0.08)] tabular-nums"
                />
                <button
                    type="button"
                    onClick={() => checkPincode()}
                    disabled={loading || pincode.length !== 6}
                    className="btn-secondary h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? (
                        <span className="h-4 w-4 rounded-full border-2 border-stone-300 border-t-ink animate-spin" aria-hidden="true" />
                    ) : "Check"}
                </button>
            </div>

            <div id="pincode-status" aria-live="polite">
                {error && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
                        <CircleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        {error}
                    </p>
                )}

                {result?.serviceable && (
                    <div className="mt-3 flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        <div className="text-[13px] leading-snug">
                            <p className="font-semibold text-ink">
                                Delivery in {result.estimated_days} business days
                                {result.city && <span className="font-normal text-stone-500"> to {result.city}{result.state_code ? `, ${result.state_code}` : ""}</span>}
                            </p>
                            {(result.cod || result.prepaid) && (
                                <p className="mt-0.5 text-stone-500">
                                    {[result.cod && "Cash on Delivery", result.prepaid && "Prepaid"].filter(Boolean).join(" and ")} available
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {result && !result.serviceable && (
                    <div className="mt-3 flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-white">
                            <CircleAlert className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                        </span>
                        <p className="text-[13px] leading-snug text-ink">
                            <span className="font-semibold">We don't deliver to {result.pincode} yet.</span>
                            <span className="text-stone-500"> Try a nearby pincode.</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
