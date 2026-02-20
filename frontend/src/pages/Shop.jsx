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

          const descRaw =
            p?.shortDescription ||
            p?.short_description ||
            p?.subtitle ||
            p?.tagline ||
            p?.description ||
            "";

          const desc = String(descRaw || "").trim();
          const oneLiner = desc
            ? desc.replace(/\s+/g, " ").slice(0, 120)
            : "Premium daily supplement with a clean label and reliable quality.";

          return (
            <div
              key={p.id}
              className="group rounded-3xl border border-black/10 bg-white overflow-hidden shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] hover:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.35)] transition-shadow"
            >
              <Link to={`/product/${p.id}`} className="block">
                <div className="relative h-56 bg-neutral-50 overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />

                  {/* Category pill */}
                  {p.category ? (
                    <div className="absolute top-4 left-4">
                      <span className="rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[11px] font-semibold text-neutral-800 shadow-sm">
                        {p.category}
                      </span>
                    </div>
                  ) : null}

                  {/* Stock badge */}
                  <div className="absolute top-4 right-4">
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm",
                        out
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-green-200 bg-green-50 text-green-700",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={[
                            "inline-block h-2.5 w-2.5 rounded-full",
                            out ? "bg-red-600" : "bg-green-600",
                          ].join(" ")}
                        />
                        {out ? "Out of stock" : "In Stock"}
                      </span>
                    </span>
                  </div>

                  {/* subtle overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                </div>
              </Link>

              <div className="p-5">
                <Link to={`/product/${p.id}`} className="block">
                  <div className="text-base font-semibold text-neutral-950 group-hover:underline">
                    {p.name}
                  </div>
                </Link>

                <div className="mt-2 text-sm text-neutral-600 leading-relaxed">
                  {oneLiner}
                </div>

                {/* Quick highlights */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-neutral-700">
                    Clean label
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-neutral-700">
                    Lab-tested
                  </span>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] text-neutral-700">
                    COD available
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-neutral-500">Price</div>
                    <div className="text-xl font-semibold text-neutral-950">{money(p.price)}</div>
                  </div>

                  <Link
                    to={`/product/${p.id}`}
                    className="text-sm font-semibold text-neutral-800 hover:text-neutral-950 underline underline-offset-4"
                  >
                    View
                  </Link>
                </div>

                <div className="mt-4">
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
