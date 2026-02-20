import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Checkout() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { items, subtotal, totalItems, clear } = useCart();

    const storageKey = useMemo(() => {
        const email = user?.email || "guest";
        return `coreatoms_address_${email}`;
    }, [user?.email]);

    const [address, setAddress] = useState({
        fullName: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
    });

    const [useSaved, setUseSaved] = useState(true);
    const [placed, setPlaced] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorToast, setErrorToast] = useState("");

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const saved = JSON.parse(raw);
                setAddress((a) => ({ ...a, ...saved }));
            }
        } catch {}
    }, [storageKey]);

    const shipping = 0;
    const total = Number(subtotal || 0) + shipping;

    const canPlace =
        !!user &&
        totalItems > 0 &&
        address.fullName.trim() &&
        /^[6-9]\d{9}$/.test(address.phone.trim()) &&
        address.line1.trim() &&
        address.city.trim() &&
        address.state.trim() &&
        /^\d{6}$/.test(address.pincode.trim());

    const onPlaceOrder = async () => {
        if (!canPlace || loading) return;

        setLoading(true);
        try {
            if (useSaved) localStorage.setItem(storageKey, JSON.stringify(address));

            // Minimal payload. DB will fetch price + name + image + totals.
            const payloadItems = (items || []).map((x) => ({
                product_id: String(x.id),
                qty: Number(x.qty || 0),
            }));

            const { data: orderId, error } = await supabase.rpc("place_order_cod", {
                p_user_id: user.id,
                p_address: address,
                p_items: payloadItems,
            });

            if (error) throw error;

            // Success animation
            setPlaced(true);

            setTimeout(() => {
                clear();
                navigate("/orders");
            }, 1400);
        } catch (e) {
            const msg = e?.message || "Unknown error";

            // Show nice toast for insufficient stock
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
                    <div className="mt-2 text-sm text-neutral-600">
                        We’re confirming your order and preparing it for dispatch.
                    </div>

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
                <Link to="/cart" className="text-sm text-neutral-700 hover:text-neutral-950 underline">
                    Back to Cart
                </Link>
                <div className="text-xs text-neutral-500">Cash on Delivery • India only</div>
            </div>

            {errorToast && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm animate-[fadeIn_0.3s_ease-out]">
                    {errorToast}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Address */}
                <div className="card p-6 lg:col-span-3">
                    <div className="text-base font-semibold text-neutral-950">Delivery details</div>
                    <div className="mt-2 text-sm text-neutral-600">
                        Enter your delivery address. You can reuse it for future orders.
                    </div>

                    <div className="mt-5 grid gap-4">
                        <Field label="Full name">
                            <input
                                value={address.fullName}
                                onChange={(e) => setAddress((a) => ({ ...a, fullName: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                placeholder="Your name"
                            />
                        </Field>

                        <Field label="Phone number (India)">
                            <input
                                value={address.phone}
                                onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                placeholder="10-digit mobile number"
                            />
                            <div className="mt-1 text-xs text-neutral-500">Example: 9876543210</div>
                        </Field>

                        <Field label="Address line 1">
                            <input
                                value={address.line1}
                                onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                placeholder="House / Flat, Street"
                            />
                        </Field>

                        <Field label="Address line 2 (optional)">
                            <input
                                value={address.line2}
                                onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                placeholder="Landmark, Area"
                            />
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="City">
                                <input
                                    value={address.city}
                                    onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                    placeholder="City"
                                />
                            </Field>

                            <Field label="State">
                                <input
                                    value={address.state}
                                    onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                    placeholder="State"
                                />
                            </Field>
                        </div>

                        <Field label="Pincode">
                            <input
                                value={address.pincode}
                                onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                placeholder="6-digit pincode"
                            />
                        </Field>

                        <label className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                            <input
                                type="checkbox"
                                checked={useSaved}
                                onChange={(e) => setUseSaved(e.target.checked)}
                                className="h-4 w-4"
                            />
                            Save this address for next orders
                        </label>
                    </div>
                </div>

                {/* Summary */}
                <div className="card p-6 lg:col-span-2">
                    <div className="text-base font-semibold text-neutral-950">Order summary</div>
                    <div className="mt-2 text-sm text-neutral-600">{totalItems} item(s)</div>

                    <div className="mt-5 space-y-3">
                        {(items || []).map((x) => (
                            <div key={x.id} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-neutral-950">{x.name}</div>
                                    <div className="text-xs text-neutral-500">
                                        {money(x.unitPrice ?? x.price)} × {x.qty}
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-neutral-950">
                                    {money((Number(x.unitPrice ?? x.price) || 0) * (Number(x.qty) || 0))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 border-t border-neutral-200 pt-4 space-y-2 text-sm">
                        <Row label="Subtotal" value={money(subtotal)} />
                        <Row label="Shipping" value={money(shipping)} />
                        <div className="flex items-center justify-between text-base font-semibold text-neutral-950">
                            <div>Total</div>
                            <div>{money(total)}</div>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3">
                        <button
                            onClick={onPlaceOrder}
                            disabled={!canPlace || loading}
                            className="btn-primary w-full disabled:opacity-50 disabled:hover:shadow-none disabled:hover:-translate-y-0"
                        >
                            {loading ? "Placing..." : "Place order (COD)"}
                        </button>

                        <button onClick={() => navigate("/cart")} className="btn-ghost w-full">
                            Review cart
                        </button>

                        {!canPlace && (
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                                Fill name, valid Indian phone, address, state, city and 6-digit pincode.
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