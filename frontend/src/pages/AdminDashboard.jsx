import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
    const { profile } = useAuth();

    // -------------------- Settings --------------------
    const [maxItems, setMaxItems] = useState(15);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [activeTab, setActiveTab] = useState("products");

    // -------------------- Orders --------------------
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [orderErr, setOrderErr] = useState("");

    // -------------------- Orders filters --------------------
    const [orderSearch, setOrderSearch] = useState(""); // matches order id or user id or email
    const [orderStatusFilter, setOrderStatusFilter] = useState("All");
    const [orderDateFrom, setOrderDateFrom] = useState(""); // YYYY-MM-DD
    const [orderDateTo, setOrderDateTo] = useState(""); // YYYY-MM-DD

    // -------------------- Products (Admin CRUD) --------------------
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productErr, setProductErr] = useState("");

    const [showProductForm, setShowProductForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [pName, setPName] = useState("");
    const [pCategory, setPCategory] = useState("");
    const [pPrice, setPPrice] = useState("");
    const [pStock, setPStock] = useState("");
    const [pDesc, setPDesc] = useState("");
    const [pActive, setPActive] = useState(true);
    const [pImageUrl, setPImageUrl] = useState("");
    const [pFile, setPFile] = useState(null);

    const [savingProduct, setSavingProduct] = useState(false);
    const [productMsg, setProductMsg] = useState("");

    const fileInputRef = useRef(null);

    // NOTE: Ensure this bucket exists in Supabase Storage
    const PRODUCT_BUCKET = "product-images";

    // -------------------- Load max items setting --------------------
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

    // -------------------- Products (load + realtime) --------------------
    const loadProducts = async () => {
        setLoadingProducts(true);
        setProductErr("");

        const { data, error } = await supabase
            .from("products")
            .select(
                `
        id,
        name,
        category,
        description,
        price_inr,
        stock_qty,
        image_url,
        is_active,
        created_at
      `
            )
            .order("created_at", { ascending: false });

        if (error) {
            setProductErr(error.message);
            setProducts([]);
        } else {
            setProducts(data || []);
        }

        setLoadingProducts(false);
    };

    useEffect(() => {
        loadProducts();

        const channel = supabase
            .channel("products-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
                loadProducts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // -------------------- Helpers --------------------
    const resetProductForm = () => {
        setEditingId(null);
        setPName("");
        setPCategory("");
        setPPrice("");
        setPStock("");
        setPDesc("");
        setPActive(true);
        setPImageUrl("");
        setPFile(null);
        setProductMsg("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const openAddProduct = () => {
        resetProductForm();
        setShowProductForm(true);
        setActiveTab("products");
    };

    const openEditProduct = (p) => {
        setActiveTab("products");
        setEditingId(p.id);
        setPName(p.name || "");
        setPCategory(p.category || "");
        setPPrice(String(p.price_inr ?? ""));
        setPStock(String(p.stock_qty ?? ""));
        setPDesc(p.description || "");
        setPActive(p.is_active !== false);
        setPImageUrl(p.image_url || "");
        setPFile(null);
        setProductMsg("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowProductForm(true);
    };

    const uploadProductImageIfAny = async () => {
        if (!pFile) return null;

        const ext = String(pFile.name || "").split(".").pop() || "jpg";
        const safeExt = ext.toLowerCase();
        const path = `products/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

        const { error: upErr } = await supabase.storage
            .from(PRODUCT_BUCKET)
            .upload(path, pFile, { cacheControl: "3600", upsert: false });

        if (upErr) throw new Error(upErr.message);

        const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
    };

    const saveProduct = async () => {
        setSavingProduct(true);
        setProductMsg("");

        try {
            const name = String(pName || "").trim();
            const category = String(pCategory || "").trim();
            const description = String(pDesc || "").trim();
            const price = Number(pPrice);
            const stock = Number(pStock);

            if (!name) throw new Error("Product name is required");
            if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price");
            if (!Number.isFinite(stock) || stock < 0) throw new Error("Enter a valid stock quantity");

            // Upload new image if selected
            let image_url = pImageUrl || "";
            const uploadedUrl = await uploadProductImageIfAny();
            if (uploadedUrl) image_url = uploadedUrl;

            const payload = {
                name,
                category: category || null,
                description: description || null,
                price_inr: price,
                stock_qty: stock,
                image_url: image_url || null,
                is_active: !!pActive,
                updated_at: new Date().toISOString(),
            };

            if (editingId) {
                const { error } = await supabase.from("products").update(payload).eq("id", editingId);
                if (error) throw new Error(error.message);
                setProductMsg("Updated ✅");
            } else {
                const { error } = await supabase.from("products").insert([
                    { ...payload, created_at: new Date().toISOString() },
                ]);
                if (error) throw new Error(error.message);
                setProductMsg("Created ✅");
            }

            await loadProducts();
            setPFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (e) {
            setProductMsg(e?.message || "Failed to save product");
        } finally {
            setSavingProduct(false);
        }
    };

    const deleteProduct = async (id) => {
        const ok = window.confirm("Delete this product? This will remove it from the shop.");
        if (!ok) return;

        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) {
            alert(error.message);
            return;
        }

        if (editingId === id) {
            resetProductForm();
            setShowProductForm(false);
        }

        loadProducts();
    };

    // -------------------- Save settings --------------------
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

    // -------------------- Load orders (with totals + user info) --------------------
    const loadOrders = async () => {
        setLoadingOrders(true);
        setOrderErr("");

        try {
            // 1️⃣ Load orders WITHOUT any join (no profiles relation required)
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });

            if (ordersError) throw new Error(ordersError.message);

            if (!ordersData || ordersData.length === 0) {
                setOrders([]);
                return;
            }

            // 2️⃣ Collect unique user_ids
            const userIds = [
                ...new Set(
                    ordersData
                        .map((o) => o.user_id)
                        .filter(Boolean)
                ),
            ];

            let profilesMap = {};

            // 3️⃣ Fetch profiles manually (NO FK needed)
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id,email,full_name")
                    .in("id", userIds);

                if (profilesData && profilesData.length > 0) {
                    profilesMap = profilesData.reduce((acc, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {});
                }
            }

            // 4️⃣ Compute totals from order_items (with product_id)
            const { data: itemsData } = await supabase
                .from("order_items")
                .select("order_id,product_id,qty,unit_price_inr,line_total_inr");

            const itemsGrouped = (itemsData || []).reduce((acc, item) => {
                if (!acc[item.order_id]) acc[item.order_id] = [];
                acc[item.order_id].push(item);
                return acc;
            }, {});

            // Fetch product names for all unique product_ids in items
            const productIds = [
                ...new Set(
                    (itemsData || [])
                        .map((it) => it.product_id)
                        .filter(Boolean)
                ),
            ];

            let productsMap = {};
            if (productIds.length > 0) {
                const { data: productsData } = await supabase
                    .from("products")
                    .select("id,name")
                    .in("id", productIds);

                if (productsData && productsData.length > 0) {
                    productsMap = productsData.reduce((acc, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {});
                }
            }

            // 5️⃣ Enrich orders
            const enriched = ordersData.map((o) => {
                const profile = profilesMap[o.user_id] || {};

                const items = itemsGrouped[o.id] || [];

                const detailedItems = items.map((it) => {
                    const p = productsMap[it.product_id] || {};
                    const qtyNum = Number(it.qty || 0);
                    const unitNum = Number(it.unit_price_inr || 0);
                    const lineNum =
                        Number(it.line_total_inr) ||
                        (qtyNum * unitNum);

                    return {
                        ...it,
                        product_name: p.name || "",
                        qty_num: qtyNum,
                        unit_price_num: unitNum,
                        line_total_num: Number.isFinite(lineNum) ? lineNum : 0,
                    };
                });

                const computedTotal = detailedItems.reduce((sum, it) => sum + (Number(it.line_total_num) || 0), 0);

                // Shipping/customer fields (works whether you store them as columns or in a JSON object)
                const ship = o.shipping_address || o.shipping || o.address || {};

                const shipping_name =
                    o.shipping_name ||
                    ship.full_name ||
                    ship.name ||
                    ship.customer_name ||
                    ship.recipient ||
                    "";

                const shipping_phone =
                    o.shipping_phone ||
                    ship.phone ||
                    ship.mobile ||
                    ship.contact ||
                    ship.contact_number ||
                    "";

                const shipping_email =
                    o.shipping_email ||
                    ship.email ||
                    "";

                const shipping_address_1 =
                    o.shipping_address_1 ||
                    ship.address1 ||
                    ship.address_line1 ||
                    ship.line1 ||
                    ship.street ||
                    "";

                const shipping_address_2 =
                    o.shipping_address_2 ||
                    ship.address2 ||
                    ship.address_line2 ||
                    ship.line2 ||
                    ship.landmark ||
                    "";

                const shipping_city = o.shipping_city || ship.city || "";
                const shipping_state = o.shipping_state || ship.state || "";
                const shipping_pincode = o.shipping_pincode || ship.pincode || ship.zip || ship.postal_code || "";
                const shipping_country = o.shipping_country || ship.country || "";

                return {
                    ...o,
                    user_email: profile.email || "",
                    user_full_name: profile.full_name || "",
                    computed_total_inr: computedTotal,
                    order_items_detailed: detailedItems,

                    shipping_name,
                    shipping_phone,
                    shipping_email,
                    shipping_address_1,
                    shipping_address_2,
                    shipping_city,
                    shipping_state,
                    shipping_pincode,
                    shipping_country,
                };
            });

            setOrders(enriched);
        } catch (e) {
            setOrders([]);
            setOrderErr(e?.message || "Failed to load orders");
        } finally {
            setLoadingOrders(false);
        }
    };

    // -------------------- Orders realtime (load only when Orders tab is open) --------------------
    useEffect(() => {
        if (activeTab !== "orders") return;

        loadOrders();

        const channel = supabase
            .channel("orders-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
                loadOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // -------------------- Update order status (normalize lowercase) --------------------
    const updateOrderStatus = async (orderId, newStatus) => {
        const normalized = String(newStatus || "").trim().toLowerCase();

        const { error } = await supabase.from("orders").update({ status: normalized }).eq("id", orderId);
        if (error) {
            alert(error.message);
            return;
        }

        loadOrders();
    };

    // -------------------- Expand/collapse order details --------------------
    const [expandedOrderIds, setExpandedOrderIds] = useState(() => new Set());
    const toggleOrderExpanded = (orderId) => {
      setExpandedOrderIds((prev) => {
        const next = new Set(prev);
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
        return next;
      });
    };

    // -------------------- Orders Filtering --------------------
    const filteredOrders = useMemo(() => {
        let list = orders || [];

        const q = String(orderSearch || "").trim().toLowerCase();
        if (q) {
            list = list.filter((o) => {
                const idStr = String(o?.id ?? "").toLowerCase();
                const userStr = String(o?.user_id ?? "").toLowerCase();
                const emailStr = String(o?.user_email ?? "").toLowerCase();
                return idStr.includes(q) || userStr.includes(q) || emailStr.includes(q);
            });
        }

        if (orderStatusFilter && orderStatusFilter !== "All") {
            const wanted = String(orderStatusFilter || "").trim().toLowerCase();
            list = list.filter((o) => String(o?.status || "").trim().toLowerCase() === wanted);
        }

        const from = orderDateFrom ? new Date(`${orderDateFrom}T00:00:00`).getTime() : null;
        const to = orderDateTo ? new Date(`${orderDateTo}T23:59:59`).getTime() : null;

        if (from || to) {
            list = list.filter((o) => {
                const t = o?.created_at ? new Date(o.created_at).getTime() : null;
                if (!t) return false;
                if (from && t < from) return false;
                if (to && t > to) return false;
                return true;
            });
        }

        return list;
    }, [orders, orderSearch, orderStatusFilter, orderDateFrom, orderDateTo]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="card p-6">
                <div className="text-xs text-neutral-500">Admin</div>
                <div className="mt-1 text-2xl font-semibold text-neutral-950">Dashboard</div>
                <div className="mt-2 text-sm text-neutral-600">
                    Logged in as <span className="font-semibold">{profile?.email}</span> • role:{" "}
                    <span className="font-semibold">{profile?.role}</span>
                </div>

                {/* Tab Bar */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab("products")}
                        className={[
                            "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                            activeTab === "products"
                                ? "border-neutral-300 bg-neutral-900 text-white shadow-sm"
                                : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
                        ].join(" ")}
                    >
                        Products
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className={[
                            "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                            activeTab === "orders"
                                ? "border-neutral-300 bg-neutral-900 text-white shadow-sm"
                                : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
                        ].join(" ")}
                    >
                        Orders
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("settings")}
                        className={[
                            "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                            activeTab === "settings"
                                ? "border-neutral-300 bg-neutral-900 text-white shadow-sm"
                                : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
                        ].join(" ")}
                    >
                        Settings
                    </button>

                    <div className="ml-auto text-xs text-neutral-500">
                        {activeTab === "products" && `${products.length} products`}
                        {activeTab === "orders" && `${orders.length} orders`}
                        {activeTab === "settings" && "App settings"}
                    </div>
                </div>

                <div className="mt-6">
                    {/* Settings Tab */}
                    {activeTab === "settings" && (
                        <div className="max-w-2xl">
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
                                    <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
                                        {saving ? "Saving..." : "Save"}
                                    </button>
                                    {msg && <div className="text-sm text-neutral-700">{msg}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Products Tab */}
                    {activeTab === "products" && (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                            <div className="text-base font-semibold text-neutral-950">Products</div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-neutral-900">Products</div>
                                        <div className="mt-1 text-xs text-neutral-500">
                                            Create, edit, delete products. Changes reflect immediately in Shop and Product Detail.
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={openAddProduct}
                                        className="rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:shadow"
                                    >
                                        + Add Product
                                    </button>
                                </div>

                                {showProductForm && (
                                    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-neutral-900">
                                                    {editingId ? `Edit Product #${editingId}` : "Add New Product"}
                                                </div>
                                                <div className="mt-1 text-xs text-neutral-500">
                                                    Upload 1 main image (jpg/png/webp). Multiple images can be added later as an upgrade.
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    resetProductForm();
                                                    setShowProductForm(false);
                                                }}
                                                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                                            >
                                                Close
                                            </button>
                                        </div>

                                        <div className="mt-4 grid gap-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <div className="text-xs text-neutral-500">Product name *</div>
                                                    <input
                                                        type="text"
                                                        value={pName}
                                                        onChange={(e) => setPName(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-xs text-neutral-500">Category</div>
                                                    <input
                                                        type="text"
                                                        value={pCategory}
                                                        onChange={(e) => setPCategory(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-neutral-500">Product description</div>
                                                <textarea
                                                    value={pDesc}
                                                    onChange={(e) => setPDesc(e.target.value)}
                                                    rows={4}
                                                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                                />
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-3">
                                                <div>
                                                    <div className="text-xs text-neutral-500">Price (₹) *</div>
                                                    <input
                                                        type="number"
                                                        value={pPrice}
                                                        onChange={(e) => setPPrice(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                                        min={0}
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-xs text-neutral-500">Stock qty *</div>
                                                    <input
                                                        type="number"
                                                        value={pStock}
                                                        onChange={(e) => setPStock(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                                        min={0}
                                                    />
                                                </div>

                                                <div className="flex items-end gap-3">
                                                    <label className="flex items-center gap-2 text-sm text-neutral-800 select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={pActive}
                                                            onChange={(e) => setPActive(e.target.checked)}
                                                            className="h-4 w-4"
                                                        />
                                                        Active
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <div className="text-xs text-neutral-500">Product image</div>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => setPFile(e.target.files?.[0] || null)}
                                                        className="mt-1 w-full text-sm"
                                                    />
                                                    {pImageUrl && (
                                                        <div className="mt-2 text-xs text-neutral-500">
                                                            Current image:
                                                            <a
                                                                href={pImageUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="ml-1 text-neutral-900 hover:underline"
                                                            >
                                                                View
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={saveProduct}
                                                        disabled={savingProduct}
                                                        className="w-full rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:shadow disabled:opacity-60"
                                                    >
                                                        {savingProduct ? "Saving..." : editingId ? "Save Changes" : "Create Product"}
                                                    </button>

                                                    {editingId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteProduct(editingId)}
                                                            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm hover:bg-neutral-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {productMsg && <div className="text-sm text-neutral-700">{productMsg}</div>}
                                        </div>
                                    </div>
                                )}

                                {/* List */}
                                <div className="mt-4">
                                    {loadingProducts ? (
                                        <div className="text-sm text-neutral-500">Loading products...</div>
                                    ) : productErr ? (
                                        <div className="text-sm text-red-600">{productErr}</div>
                                    ) : products.length === 0 ? (
                                        <div className="text-sm text-neutral-500">No products yet.</div>
                                    ) : (
                                        <div className="mt-2 overflow-x-auto">
                                            <table className="w-full table-fixed text-sm">
                                                <thead>
                                                <tr className="text-left text-neutral-500 border-b">
                                                    <th className="py-2 pr-4 w-[40%]">Product</th>
                                                    <th className="py-2 pr-4 w-[14%]">Price</th>
                                                    <th className="py-2 pr-4 w-[14%]">Stock</th>
                                                    <th className="py-2 pr-4 w-[10%]">Active</th>
                                                    <th className="py-2 pr-4 w-[16%]">Created</th>
                                                    <th className="py-2 w-[6%]">Action</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {products.map((p) => {
                                                    const out = Number(p.stock_qty || 0) <= 0;

                                                    return (
                                                        <tr key={p.id} className="border-b align-top">
                                                            <td className="py-2 pr-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-10 w-10 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
                                                                        {p.image_url ? (
                                                                            <img
                                                                                src={p.image_url}
                                                                                alt={p.name}
                                                                                className="h-full w-full object-cover"
                                                                                loading="lazy"
                                                                            />
                                                                        ) : null}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-semibold text-neutral-900">{p.name}</div>
                                                                        <div className="text-xs text-neutral-500">{p.category || "—"}</div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="py-2 pr-4">₹{Number(p.price_inr || 0).toLocaleString("en-IN")}</td>

                                                            <td className="py-2 pr-4">
                                  <span className={out ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                                    {out ? "Out of stock" : "In stock"}
                                  </span>
                                                                <span className="ml-2 text-xs text-neutral-500">({Number(p.stock_qty || 0)})</span>
                                                            </td>

                                                            <td className="py-2 pr-4">
                                  <span
                                      className={
                                          p.is_active ? "text-green-600 font-semibold" : "text-neutral-500 font-semibold"
                                      }
                                  >
                                    {p.is_active ? "Yes" : "No"}
                                  </span>
                                                            </td>

                                                            <td className="py-2 pr-4 text-xs text-neutral-500">
                                                                {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                                                            </td>

                                                            <td className="py-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditProduct(p)}
                                                                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50"
                                                                >
                                                                    Edit
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Orders Tab */}
                    {activeTab === "orders" && (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                            <div className="text-base font-semibold text-neutral-950">Orders</div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold text-neutral-900">Orders Management</div>

                                {/* Filter Bar */}
                                <div className="mt-3 grid gap-3 md:grid-cols-4">
                                    <div>
                                        <div className="text-xs text-neutral-500">Search (Order ID / User)</div>
                                        <input
                                            value={orderSearch}
                                            onChange={(e) => setOrderSearch(e.target.value)}
                                            placeholder="Search by order id, user id, or email..."
                                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-neutral-500">Status</div>
                                        <select
                                            value={orderStatusFilter}
                                            onChange={(e) => setOrderStatusFilter(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                        >
                                            <option value="All">All</option>
                                            <option value="placed">Placed</option>
                                            <option value="packed">Packed</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                        </select>
                                    </div>

                                    <div>
                                        <div className="text-xs text-neutral-500">From</div>
                                        <input
                                            type="date"
                                            value={orderDateFrom}
                                            onChange={(e) => setOrderDateFrom(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-neutral-500">To</div>
                                        <input
                                            type="date"
                                            value={orderDateTo}
                                            onChange={(e) => setOrderDateTo(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-neutral-500">
                                        Showing <span className="font-semibold text-neutral-900">{filteredOrders.length}</span> of{" "}
                                        {orders.length}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOrderSearch("");
                                            setOrderStatusFilter("All");
                                            setOrderDateFrom("");
                                            setOrderDateTo("");
                                        }}
                                        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                                    >
                                        Clear filters
                                    </button>
                                </div>

                                {orderErr && <div className="mt-3 text-sm text-red-600">{orderErr}</div>}

                                {loadingOrders ? (
                                    <div className="mt-4 text-sm text-neutral-500">Loading orders...</div>
                                ) : filteredOrders.length === 0 ? (
                                    <div className="mt-4 text-sm text-neutral-500">No orders yet.</div>
                                ) : (
                                    <div className="mt-3 overflow-x-auto">
                                        <table className="w-full table-fixed text-sm">
                                            <thead>
                                            <tr className="text-left text-neutral-500 border-b">
                                                <th className="py-2 pr-4 w-[18%]">Order ID</th>
                                                <th className="py-2 pr-4 w-[28%]">User</th>
                                                <th className="py-2 pr-4 w-[12%]">Total</th>
                                                <th className="py-2 pr-4 w-[12%]">Status</th>
                                                <th className="py-2 pr-4 w-[18%]">Created</th>
                                                <th className="py-2 w-[12%]">Actions</th>
                                            </tr>
                                            </thead>

                                            <tbody>
                                            {filteredOrders.map((o) => {
                                                const st = String(o.status || "").trim().toLowerCase();

                                                const badge = [
                                                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                                                    st === "placed" && "bg-green-50 text-green-700",
                                                    st === "packed" && "bg-yellow-50 text-yellow-700",
                                                    st === "shipped" && "bg-purple-50 text-purple-700",
                                                    st === "delivered" && "bg-green-50 text-green-700",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ");

                                                return (
                                                    <>
                                                    <tr key={o.id} className="border-b align-top">
                                                        <td className="py-2 pr-4 text-xs font-semibold text-neutral-900 break-all">#{o.id}</td>

                                                        <td className="py-2 pr-4 text-xs text-neutral-600 break-all">
                                                            {o.user_full_name
                                                                ? `${o.user_full_name}${o.user_email ? ` (${o.user_email})` : ""}`
                                                                : o.user_email
                                                                    ? o.user_email
                                                                    : o.user_id}
                                                        </td>

                                                        <td className="py-2 pr-4">₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}</td>

                                                        <td className="py-2 pr-4">
                                                            <span className={badge}>{st || "—"}</span>
                                                        </td>

                                                        <td className="py-2 pr-4 text-xs text-neutral-500">
                                                            {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                                        </td>

                                                        <td className="py-2">
                                                          <div className="flex flex-col gap-2">
                                                            <select
                                                                value={st}
                                                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                                className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs"
                                                            >
                                                                <option value="placed">Placed</option>
                                                                <option value="packed">Packed</option>
                                                                <option value="shipped">Shipped</option>
                                                                <option value="delivered">Delivered</option>
                                                            </select>
                                                            <button
                                                              type="button"
                                                              onClick={() => toggleOrderExpanded(o.id)}
                                                              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
                                                            >
                                                              {expandedOrderIds.has(o.id) ? "Hide details" : "View details"}
                                                            </button>
                                                          </div>
                                                        </td>
                                                    </tr>
                                                    {expandedOrderIds.has(o.id) && (
                                                      <tr className="border-b bg-neutral-50/50">
                                                        <td colSpan={6} className="py-3 px-2">
                                                          <div className="grid gap-4 md:grid-cols-3">
                                                            {/* Customer */}
                                                            <div className="rounded-xl border border-neutral-200 bg-white p-4">
                                                              <div className="text-xs font-semibold text-neutral-500">Customer</div>
                                                              <div className="mt-2 text-sm text-neutral-900">
                                                                <div className="font-semibold">
                                                                  {o.shipping_name || o.user_full_name || "(No name)"}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-600">
                                                                  Email: {o.shipping_email || o.user_email || "(No email)"}
                                                                </div>
                                                                <div className="mt-1 text-xs text-neutral-600">
                                                                  Phone: {o.shipping_phone || "(No phone)"}
                                                                </div>
                                                              </div>
                                                            </div>

                                                            {/* Address */}
                                                            <div className="rounded-xl border border-neutral-200 bg-white p-4">
                                                              <div className="text-xs font-semibold text-neutral-500">Shipping Address</div>
                                                              <div className="mt-2 text-sm text-neutral-900">
                                                                <div className="text-xs text-neutral-700 leading-relaxed">
                                                                  {[
                                                                    o.shipping_address_1,
                                                                    o.shipping_address_2,
                                                                    [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
                                                                    o.shipping_pincode,
                                                                    o.shipping_country,
                                                                  ]
                                                                    .filter(Boolean)
                                                                    .join("\n")
                                                                    .split("\n")
                                                                    .map((line, idx) => (
                                                                      <div key={idx}>{line}</div>
                                                                    ))}
                                                                </div>
                                                              </div>
                                                            </div>

                                                            {/* Items */}
                                                            <div className="rounded-xl border border-neutral-200 bg-white p-4">
                                                              <div className="text-xs font-semibold text-neutral-500">Items</div>
                                                              <div className="mt-2 space-y-2">
                                                                {(o.order_items_detailed || []).length === 0 ? (
                                                                  <div className="text-xs text-neutral-600">No items found for this order.</div>
                                                                ) : (
                                                                  (o.order_items_detailed || []).map((it, idx) => (
                                                                    <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                                                                      <div className="min-w-0">
                                                                        <div className="font-semibold text-neutral-900 truncate">
                                                                          {it.product_name || `Product #${it.product_id}`}
                                                                        </div>
                                                                        <div className="text-neutral-600">Qty: {Number(it.qty_num || it.qty || 0)}</div>
                                                                      </div>
                                                                      <div className="shrink-0 text-neutral-900 font-semibold">
                                                                        ₹{Number(it.line_total_num || 0).toLocaleString("en-IN")}
                                                                      </div>
                                                                    </div>
                                                                  ))
                                                                )}

                                                                <div className="pt-2 mt-2 border-t border-neutral-200 flex items-center justify-between text-xs">
                                                                  <div className="text-neutral-600">Order Total</div>
                                                                  <div className="font-semibold text-neutral-900">₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}</div>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </td>
                                                      </tr>
                                                    )}
                                                    </>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}