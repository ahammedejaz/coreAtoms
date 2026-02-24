/**
 * AdminSettingsCard.jsx — Inline card for editing the "max items per order" setting.
 *
 * Reads the current value from Supabase via `getMaxItemsPerOrder()`, lets
 * the admin edit it, and saves via `setMaxItemsPerOrder()`. After saving,
 * calls `refreshMaxItems()` on the CartContext so the limit takes effect
 * immediately for all users.
 *
 * @module components/AdminSettingsCard
 */
import { useEffect, useState } from "react";
import { getMaxItemsPerOrder, setMaxItemsPerOrder } from "../services/api/settings";
import { useCart } from "../context/CartContext";

export default function AdminSettingsCard() {
  const { refreshMaxItems } = useCart();
  const [value, setValue] = useState(15);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const n = await getMaxItemsPerOrder();
        setValue(n);
      } catch {
        setValue(15);
      }
    })();
  }, []);

  const save = async () => {
    setMsg("");
    const n = Math.max(1, Number(value || 1));
    setSaving(true);
    try {
      await setMaxItemsPerOrder(n);
      await refreshMaxItems();
      setMsg("Saved ✅");
    } catch (e) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 1800);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold text-neutral-950">Store Settings</div>
      <p className="mt-1 text-sm text-neutral-600">Control global limits without code changes.</p>

      <div className="mt-5">
        <div className="text-xs font-medium text-neutral-700 mb-1">Max items per order</div>
        <div className="flex items-center gap-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
            placeholder="15"
          />
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm hover:shadow hover:scale-[1.01] transition disabled:opacity-50"
            type="button"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {msg && <div className="text-sm text-neutral-700">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
