import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Shop() {
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  // UI feedback state
  const [toast, setToast] = useState({ show: false, text: "" });
  const [justAddedId, setJustAddedId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const list = await fetchProducts();
        if (alive) setProducts(list);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load products");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) set.add(c);
    });
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const active = useMemo(() => {
    let list = (products || []).filter((p) => p?.isActive !== false);

    if (category && category !== "All") {
      list = list.filter((p) => String(p?.category || "") === String(category));
    }

    const q = String(query || "").trim().toLowerCase();
    if (q) {
      list = list.filter((p) => String(p?.name || "").toLowerCase().includes(q));
    }

    return list;
  }, [products, category, query]);

  const showToast = (text) => {
    setToast({ show: true, text });
    window.clearTimeout(window.__coreatoms_toast);
    window.__coreatoms_toast = window.setTimeout(() => {
      setToast({ show: false, text: "" });
    }, 1400);
  };

  const handleAdd = (p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    showToast(`${p.name} added to cart`);
    window.clearTimeout(window.__coreatoms_addedbtn);
    window.__coreatoms_addedbtn = window.setTimeout(() => {
      setJustAddedId(null);
    }, 900);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-sm text-neutral-600">Loading products…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold text-neutral-950">Could not load products</div>
          <div className="mt-2 text-sm text-neutral-600">{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Shop</h1>
          <p className="mt-1 text-sm text-neutral-600">Premium supplements. COD available (India).</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <div className="text-xs text-neutral-500">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full sm:w-64 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-neutral-500">Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {active.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <div className="text-base font-semibold text-neutral-950">No products found</div>
              <div className="mt-1 text-sm text-neutral-600">Try a different search or category.</div>
            </div>
          </div>
        ) : null}
        {active.length > 0 && active.map((p) => {
          const out = (p.stockQty ?? 0) <= 0;
          const added = justAddedId === p.id;

          return (
            <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <Link to={`/product/${p.id}`}>
                <div className="h-52 bg-neutral-50 overflow-hidden">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              </Link>

              <div className="p-4">
                <div className="text-xs text-neutral-500">{p.category}</div>
                <Link to={`/product/${p.id}`}>
                  <div className="mt-1 font-semibold text-neutral-950 hover:underline">{p.name}</div>
                </Link>

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-lg font-semibold text-neutral-950">{money(p.price)}</div>
                  <div
                    className={[
                      "text-xs font-semibold",
                      out ? "text-red-600" : "text-green-600",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={[
                          "inline-block h-2.5 w-2.5 rounded-full shrink-0",
                          out ? "bg-red-600" : "bg-green-600",
                        ].join(" ")}
                      />
                      {out ? "Out of stock" : "In Stock"}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    onClick={() => handleAdd(p)}
                    disabled={out}
                    className={[
                      "w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition",
                      "bg-gradient-to-r from-neutral-200 to-neutral-300 text-neutral-950",
                      "hover:shadow hover:scale-[1.01]",
                      "disabled:opacity-50 disabled:hover:scale-100",
                      added ? "scale-[1.02] shadow" : "",
                    ].join(" ")}
                    type="button"
                  >
                    {added ? "Added ✓" : "Add to cart"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      <div
        className={[
          "fixed bottom-5 right-5 z-50 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-lg",
          "text-sm text-neutral-900 transition-all duration-300",
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
        ].join(" ")}
      >
        <div className="font-semibold">Added to cart ✅</div>
        <div className="text-xs text-neutral-600">{toast.text}</div>
      </div>
    </div>
  );
}
