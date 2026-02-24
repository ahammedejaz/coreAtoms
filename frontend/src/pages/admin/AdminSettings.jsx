import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";

export default function AdminSettings() {
    const { showToast } = useToast();
    const [maxItems, setMaxItems] = useState(15);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        supabase.from("app_settings").select("value")
            .eq("key", "max_items_per_order").maybeSingle()
            .then(({ data }) => {
                const n = Number(data?.value?.n);
                if (Number.isFinite(n) && n > 0) setMaxItems(n);
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

    // Ctrl+S to save
    const saveRef = useRef(save);
    saveRef.current = save;
    const handleCtrlS = useCallback((e) => { e.preventDefault(); saveRef.current(); }, []);
    useKeyboardShortcut("ctrl+s", handleCtrlS);

    return (
        <div className="max-w-2xl">
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
        </div>
    );
}
