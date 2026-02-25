/**
 * razorpay.js — Razorpay Checkout integration utility.
 *
 * Dynamically loads the Razorpay checkout.js script and provides
 * a function to open the payment popup.
 *
 * The Key ID comes from the VITE_RAZORPAY_KEY_ID environment variable.
 * The Key Secret is NEVER on the frontend — it lives in Supabase secrets.
 */

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptLoaded = false;
let scriptLoading = false;

/**
 * Dynamically loads the Razorpay checkout.js script.
 * Returns a promise that resolves when the script is ready.
 */
export function loadRazorpay() {
    return new Promise((resolve, reject) => {
        if (scriptLoaded && window.Razorpay) {
            resolve(window.Razorpay);
            return;
        }

        if (scriptLoading) {
            // Wait for the existing load to finish
            const interval = setInterval(() => {
                if (window.Razorpay) {
                    clearInterval(interval);
                    resolve(window.Razorpay);
                }
            }, 100);
            return;
        }

        scriptLoading = true;
        const script = document.createElement("script");
        script.src = RAZORPAY_SCRIPT_URL;
        script.async = true;

        script.onload = () => {
            scriptLoaded = true;
            scriptLoading = false;
            resolve(window.Razorpay);
        };

        script.onerror = () => {
            scriptLoading = false;
            reject(new Error("Failed to load Razorpay SDK"));
        };

        document.body.appendChild(script);
    });
}

/**
 * Gets the Razorpay Key ID from environment variables.
 * Returns null if not configured.
 */
export function getRazorpayKeyId() {
    return import.meta.env.VITE_RAZORPAY_KEY_ID || null;
}

/**
 * Opens the Razorpay Checkout popup.
 *
 * @param {Object} options
 * @param {string} options.razorpayOrderId - The order ID from Razorpay (created via Edge Function)
 * @param {number} options.amount         - Amount in PAISE (e.g., ₹500 = 50000)
 * @param {string} options.currency       - Currency code (default: "INR")
 * @param {string} options.name           - Business name shown in popup
 * @param {string} options.description    - Description shown in popup
 * @param {Object} options.prefill        - { name, email, contact }
 * @param {Function} options.onSuccess    - Called with { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 * @param {Function} options.onDismiss    - Called when user closes the popup
 */
export async function openRazorpayCheckout({
    razorpayOrderId,
    amount,
    currency = "INR",
    name = "Core Atoms",
    description = "Order Payment",
    prefill = {},
    onSuccess,
    onDismiss,
}) {
    const keyId = getRazorpayKeyId();
    if (!keyId) {
        throw new Error("Razorpay Key ID not configured. Set VITE_RAZORPAY_KEY_ID in your .env file.");
    }

    const Razorpay = await loadRazorpay();

    const options = {
        key: keyId,
        amount,
        currency,
        name,
        description,
        order_id: razorpayOrderId,
        prefill: {
            name: prefill.name || "",
            email: prefill.email || "",
            contact: prefill.contact || "",
        },
        theme: {
            color: "#1e3a5f",
        },
        handler: (response) => {
            // response contains: razorpay_payment_id, razorpay_order_id, razorpay_signature
            if (onSuccess) onSuccess(response);
        },
        modal: {
            ondismiss: () => {
                if (onDismiss) onDismiss();
            },
        },
    };

    const rzp = new Razorpay(options);
    rzp.open();
    return rzp;
}
