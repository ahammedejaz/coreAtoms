/**
 * PincodeChecker.jsx — Check delivery availability by pincode.
 *
 * Users enter their 6-digit pincode to see:
 *   - Whether delivery is available
 *   - Estimated delivery days (3-5 metro, 5-7 others, 7-10 ODA)
 *   - COD availability
 *   - City name
 *
 * Persists the last checked pincode in localStorage for convenience.
 *
 * @module components/PincodeChecker
 */
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";

const LS_KEY = "coreatoms_pincode";

export default function PincodeChecker() {
    const [pincode, setPincode] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    // Load saved pincode on mount
    useEffect(() => {
        const saved = localStorage.getItem(LS_KEY);
        if (saved && /^\d{6}$/.test(saved)) {
            setPincode(saved);
            checkPincode(saved);
        }
    }, []);

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

    const handleKeyDown = (e) => {
        if (e.key === "Enter") checkPincode();
    };

    return (
        <div className="rounded-xl border border-[#E8E4DE] bg-stone-50/50 p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <svg className="h-4 w-4 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-semibold text-stone-700">Check Delivery Availability</span>
            </div>

            {/* Input row */}
            <div className="flex gap-2 max-w-xs">
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPincode(val);
                        // Clear previous result when typing
                        if (result) setResult(null);
                        if (error) setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter pincode"
                    className="flex-1 rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 focus:outline-none transition-colors"
                />
                <button
                    type="button"
                    onClick={() => checkPincode()}
                    disabled={loading || pincode.length !== 6}
                    className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3a5f]/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                    {loading ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    )}
                    <span className="hidden sm:inline">Check</span>
                </button>
            </div>

            {/* Error */}
            {error && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
            )}

            {/* Result — Serviceable */}
            {result?.serviceable && (
                <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                    {/* Delivery estimate */}
                    <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">✓</span>
                        <span className="text-sm font-semibold text-emerald-800">
                            Delivery in {result.estimated_days} business days
                        </span>
                    </div>

                    {/* City info */}
                    {result.city && (
                        <p className="text-xs text-emerald-700 ml-7">
                            📍 {result.city}{result.state_code ? `, ${result.state_code}` : ""}
                        </p>
                    )}

                    {/* COD / Prepaid badges */}
                    <div className="flex gap-2 ml-7">
                        {result.cod && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                COD Available
                            </span>
                        )}
                        {result.prepaid && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Prepaid
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Result — Not Serviceable */}
            {result && !result.serviceable && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px]">✕</span>
                        <span className="text-sm font-semibold text-red-700">
                            Delivery not available
                        </span>
                    </div>
                    <p className="text-xs text-red-600 mt-1.5 ml-7">
                        Sorry, we don't deliver to pincode {result.pincode} yet. Try a nearby pincode.
                    </p>
                </div>
            )}
        </div>
    );
}
