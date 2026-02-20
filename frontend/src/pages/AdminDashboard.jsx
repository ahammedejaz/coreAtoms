import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [maxItems, setMaxItems] = useState(15);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "max_items_per_order")
        .maybeSingle();

      const n = Number(data?.value?.n);
      if (Number.isFinite(n) && n > 0) setMaxItems(n);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");

    const n = Number(maxItems);
    if (!Number.isFinite(n) || n <= 0) {
      setMsg("Enter a valid number > 0");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("app_settings")
      .update({ value: { n }, updated_at: new Date().toISOString() })
      .eq("key", "max_items_per_order");

    if (error) setMsg(error.message);
    else setMsg("Saved ✅");

    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="card p-6">
        <div className="text-xs text-neutral-500">Admin</div>
        <div className="mt-1 text-2xl font-semibold text-neutral-950">Dashboard</div>
        <div className="mt-2 text-sm text-neutral-600">
          Logged in as <span className="font-semibold">{profile?.email}</span> • role:{" "}
          <span className="font-semibold">{profile?.role}</span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-base font-semibold text-neutral-950">Order settings</div>
            <div className="mt-2 text-sm text-neutral-600">
              Set the max number of total items allowed per order (dynamic).
            </div>

            <div className="mt-4">
              <div className="text-xs text-neutral-500">Max items per order</div>
              <input
                type="number"
                value={maxItems}
                onChange={(e) => setMaxItems(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                min={1}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {msg && <div className="text-sm text-neutral-700">{msg}</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-base font-semibold text-neutral-950">Next: Products & Orders</div>
            <div className="mt-2 text-sm text-neutral-700 leading-relaxed">
              Next we will add:
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Add / edit / delete products (with images)</li>
                <li>Update stock quantities</li>
                <li>View orders received</li>
                <li>Update order status (packed, shipped, delivered)</li>
              </ul>
            </div>

            <div className="mt-4 text-xs text-neutral-600">
              This needs Supabase tables for products + orders. We’ll do it after UI is perfect.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
