/**
 * PromoBanner.jsx — Full-screen promo popup for sales/events.
 *
 * Fetches `promo_banner` from `app_settings`. When enabled with an image,
 * renders a large, immersive popup modal that fills most of the viewport
 * with the admin-uploaded banner image. Includes a "Shop Now" CTA and
 * smooth entrance/exit animations.
 *
 * @module components/PromoBanner
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase/client";

const DISMISS_KEY = "coreatoms_promo_dismissed";

export default function PromoBanner() {
    const [banner, setBanner] = useState(null);
    const [dismissed, setDismissed] = useState(true);
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

        supabase
            .from("app_settings")
            .select("value")
            .eq("key", "promo_banner")
            .maybeSingle()
            .then(({ data }) => {
                if (data?.value?.enabled && data.value.image_url) {
                    setBanner(data.value);
                    setDismissed(false);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => setAnimateIn(true));
                    });
                }
            });
    }, []);

    const dismiss = () => {
        setAnimateIn(false);
        setTimeout(() => {
            setDismissed(true);
            sessionStorage.setItem(DISMISS_KEY, "1");
        }, 350);
    };

    if (dismissed || !banner) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            onClick={dismiss}
            style={{
                backgroundColor: animateIn ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0)",
                backdropFilter: animateIn ? "blur(12px)" : "blur(0px)",
                WebkitBackdropFilter: animateIn ? "blur(12px)" : "blur(0px)",
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
        >
            {/* Popup — large, nearly full viewport */}
            <div
                className="relative w-[94vw] max-w-5xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                    transform: animateIn ? "scale(1)" : "scale(0.92)",
                    opacity: animateIn ? 1 : 0,
                    transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease",
                }}
            >
                {/* Close button — floating outside top-right */}
                <button
                    type="button"
                    onClick={dismiss}
                    className="absolute -top-4 -right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 shadow-xl hover:bg-stone-100 hover:text-stone-900 hover:scale-110 transition-all duration-200"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Image container */}
                <div className="rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
                    <img
                        src={banner.image_url}
                        alt="Special offer"
                        className="w-full block"
                        style={{ maxHeight: "82vh", objectFit: "cover" }}
                    />

                    {/* Bottom gradient + CTA */}
                    <div
                        className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex items-end justify-center"
                        style={{
                            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
                            borderRadius: "0 0 1.5rem 1.5rem",
                        }}
                    >
                        <Link
                            to="/shop"
                            onClick={dismiss}
                            className="group inline-flex items-center gap-3 rounded-2xl bg-white py-4 px-10 text-base font-bold text-stone-900 shadow-2xl hover:shadow-[0_8px_30px_rgba(255,255,255,0.3)] active:scale-[0.97] transition-all duration-200"
                        >
                            Shop Now
                            <svg
                                xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                className="transition-transform duration-200 group-hover:translate-x-1"
                            >
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
