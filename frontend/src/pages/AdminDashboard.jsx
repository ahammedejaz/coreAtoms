import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

    // Orders expand (details)
    const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());

    const toggleOrderExpanded = (orderId) => {
        setExpandedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    // -------------------- Reviews --------------------
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [reviewErr, setReviewErr] = useState("");
    const [reviewSearch, setReviewSearch] = useState("");

    const loadReviews = async () => {
        setLoadingReviews(true);
        setReviewErr("");

        // Fetch reviews + product name — NO profiles join (causes schema cache error)
        const { data, error } = await supabase
            .from("product_reviews")
            .select("id,rating,title,body,created_at,product_id,user_id,order_id,products(name)")
            .order("created_at", { ascending: false });

        if (error) { setReviewErr(error.message); setReviews([]); setLoadingReviews(false); return; }

        const rawReviews = data || [];

        // Fetch profile names + emails separately
        const userIds = [...new Set(rawReviews.map((r) => r.user_id).filter(Boolean))];
        const profileMap = {};
        if (userIds.length > 0) {
            const { data: profileRows } = await supabase
                .from("profiles")
                .select("id,full_name,email")
                .in("id", userIds);
            (profileRows || []).forEach((p) => { profileMap[p.id] = p; });
        }

        const enriched = rawReviews.map((r) => ({
            ...r,
            _profile: profileMap[r.user_id] || null,
        }));

        setReviews(enriched);
        setLoadingReviews(false);
    };

    useEffect(() => {
        if (activeTab === "reviews") loadReviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const deleteReview = async (id) => {
        if (!window.confirm("Delete this review? This cannot be undone.")) return;
        const { error } = await supabase.from("product_reviews").delete().eq("id", id);
        if (error) { alert(error.message); return; }
        setReviews((prev) => prev.filter((r) => r.id !== id));
    };

    const filteredReviews = useMemo(() => {
        const q = String(reviewSearch || "").trim().toLowerCase();
        if (!q) return reviews;
        return reviews.filter((r) =>
            String(r.products?.name || "").toLowerCase().includes(q) ||
            String(r._profile?.full_name || "").toLowerCase().includes(q) ||
            String(r._profile?.email || "").toLowerCase().includes(q) ||
            String(r.title || "").toLowerCase().includes(q) ||
            String(r.body || "").toLowerCase().includes(q)
        );
    }, [reviews, reviewSearch]);

    // -------------------- Orders filters --------------------
    const [orderSearch, setOrderSearch] = useState("");
    const [orderStatusFilter, setOrderStatusFilter] = useState("All");
    const [orderDateFrom, setOrderDateFrom] = useState("");
    const [orderDateTo, setOrderDateTo] = useState("");

    // -------------------- Products (Admin CRUD) --------------------
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productErr, setProductErr] = useState("");

    const [showProductForm, setShowProductForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [pName, setPName] = useState("");
    const [pSku, setPSku] = useState("");
    const [pCategory, setPCategory] = useState("");
    const [pPrice, setPPrice] = useState("");
    const [pStock, setPStock] = useState("");
    const [pDesc, setPDesc] = useState("");
    const [pActive, setPActive] = useState(true);
    const [pImageUrl, setPImageUrl] = useState("");
    const [pFile, setPFile] = useState(null);
    const [pAboutText, setPAboutText] = useState("");
    const [pBestFor, setPBestFor] = useState("");
    const [pPairsWellWith, setPPairsWellWith] = useState("");
    const [pRecommendedStack, setPRecommendedStack] = useState("");
    const [pHighlights, setPHighlights] = useState([]); // e.g. ["Clean label", "Lab-tested"]
    const [pHighlightInput, setPHighlightInput] = useState("");
    const [pImagePreview, setPImagePreview] = useState(""); // live preview URL

    // -------------------- Variants --------------------
    const [variants, setVariants] = useState([]); // [{id?, label, price_inr, stock_qty, sku, sort_order, is_active, _dirty}]
    const [variantErr, setVariantErr] = useState("");

    // -------------------- Extra images (product_images table) --------------------
    const [extraImages, setExtraImages] = useState([]); // [{ id, image_url, sort_order }]
    const [extraImageFiles, setExtraImageFiles] = useState([]); // pending uploads
    const [uploadingExtra, setUploadingExtra] = useState(false);
    const extraFileInputRef = useRef(null);

    // Inline stock edit
    const [inlineStockId, setInlineStockId] = useState(null);
    const [inlineStockValue, setInlineStockValue] = useState("");
    const [savingInlineStock, setSavingInlineStock] = useState(false);

    // Product search
    const [productSearch, setProductSearch] = useState("");

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
        created_at,
        about_text,
        best_for,
        pairs_well_with,
        recommended_stack,
        highlights,
        product_variants(id,label,stock_qty,is_active)
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
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "products" },
                () => {
                    loadProducts();
                }
            )
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
        setPSku("");
        setPCategory("");
        setPPrice("");
        setPStock("");
        setPDesc("");
        setPActive(true);
        setPImageUrl("");
        setPFile(null);
        setPImagePreview("");
        setExtraImages([]);
        setExtraImageFiles([]);
        setPAboutText("");
        setPBestFor("");
        setPPairsWellWith("");
        setPRecommendedStack("");
        setPHighlights([]);
        setPHighlightInput("");
        setVariants([]);
        setVariantErr("");
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
        setPSku(p.sku || "");
        setPCategory(p.category || "");
        setPPrice(String(p.price_inr ?? ""));
        setPStock(String(p.stock_qty ?? ""));
        setPDesc(p.description || "");
        setPActive(p.is_active !== false);
        setPImageUrl(p.image_url || "");
        setPImagePreview(p.image_url || "");
        setExtraImageFiles([]);
        // Load existing extra images from product_images table
        (async () => {
            const { data } = await supabase
                .from("product_images")
                .select("id,image_url,sort_order")
                .eq("product_id", p.id)
                .order("sort_order", { ascending: true });
            setExtraImages(data || []);
        })();
        setPAboutText(p.about_text || "");
        setPBestFor(p.best_for || "");
        setPPairsWellWith(p.pairs_well_with || "");
        setPRecommendedStack(p.recommended_stack || "");
        setPHighlights(Array.isArray(p.highlights) ? p.highlights : []);
        setPHighlightInput("");
        // Load variants
        setVariantErr("");
        (async () => {
            const { data: vData } = await supabase
                .from("product_variants")
                .select("id,label,price_inr,stock_qty,sku,sort_order,is_active")
                .eq("product_id", p.id)
                .order("sort_order", { ascending: true });
            setVariants((vData || []).map((v) => ({ ...v, _dirty: false })));
        })();
        setPFile(null);
        setProductMsg("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowProductForm(true);
    };

    const uploadProductImageIfAny = async () => {
        if (!pFile) return null;

        const ext = String(pFile.name || "").split(".").pop() || "jpg";
        const safeExt = ext.toLowerCase();
        const path = `products/${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}.${safeExt}`;

        const { error: upErr } = await supabase.storage
            .from(PRODUCT_BUCKET)
            .upload(path, pFile, { cacheControl: "3600", upsert: false });

        if (upErr) throw new Error(upErr.message);

        const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
    };

    const uploadAndSaveExtraImages = async (productId) => {
        if (extraImageFiles.length === 0) return;
        setUploadingExtra(true);
        try {
            // Get current max sort_order
            const currentMax = extraImages.reduce((m, img) => Math.max(m, img.sort_order ?? 0), -1);
            const inserts = [];
            for (let i = 0; i < extraImageFiles.length; i++) {
                const file = extraImageFiles[i];
                const ext = String(file.name || "").split(".").pop().toLowerCase() || "jpg";
                const path = `products/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
                const { error: upErr } = await supabase.storage
                    .from(PRODUCT_BUCKET)
                    .upload(path, file, { cacheControl: "3600", upsert: false });
                if (upErr) throw new Error(upErr.message);
                const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
                if (data?.publicUrl) {
                    inserts.push({ product_id: productId, image_url: data.publicUrl, sort_order: currentMax + 1 + i });
                }
            }
            if (inserts.length > 0) {
                const { error } = await supabase.from("product_images").insert(inserts);
                if (error) throw new Error(error.message);
            }
        } finally {
            setUploadingExtra(false);
        }
    };

    const deleteExtraImage = async (imgId) => {
        const ok = window.confirm("Remove this image?");
        if (!ok) return;
        const { error } = await supabase.from("product_images").delete().eq("id", imgId);
        if (error) { alert(error.message); return; }
        setExtraImages((prev) => prev.filter((img) => img.id !== imgId));
    };

    const moveExtraImage = async (imgId, direction) => {
        const idx = extraImages.findIndex((img) => img.id === imgId);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= extraImages.length) return;

        const updated = [...extraImages];
        const tmp = updated[idx].sort_order;
        updated[idx] = { ...updated[idx], sort_order: updated[swapIdx].sort_order };
        updated[swapIdx] = { ...updated[swapIdx], sort_order: tmp };
        [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
        setExtraImages(updated);

        // Persist sort_order to DB
        await supabase.from("product_images").update({ sort_order: updated[idx].sort_order }).eq("id", updated[idx].id);
        await supabase.from("product_images").update({ sort_order: updated[swapIdx].sort_order }).eq("id", updated[swapIdx].id);
    };

    const saveVariants = async (productId) => {
        setVariantErr("");
        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const label = String(v.label || "").trim();
            if (!label) continue;
            const price = Number(v.price_inr);
            const stock = Number(v.stock_qty ?? 0);
            if (!Number.isFinite(price) || price < 0) continue;

            const payload = {
                product_id: productId,
                label,
                price_inr: price,
                stock_qty: stock,
                sku: String(v.sku || "").trim() || null,
                sort_order: i,
                is_active: v.is_active !== false,
                updated_at: new Date().toISOString(),
            };

            if (v.id) {
                // existing row — update
                const { error } = await supabase.from("product_variants").update(payload).eq("id", v.id);
                if (error) { setVariantErr(error.message); return; }
            } else {
                // new row — insert
                const { error } = await supabase.from("product_variants").insert({ ...payload });
                if (error) { setVariantErr(error.message); return; }
            }
        }
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
            if (!Number.isFinite(price) || price < 0)
                throw new Error("Enter a valid price");
            if (!Number.isFinite(stock) || stock < 0)
                throw new Error("Enter a valid stock quantity");

            // Upload new image if selected
            let image_url = pImageUrl || "";
            const uploadedUrl = await uploadProductImageIfAny();
            if (uploadedUrl) image_url = uploadedUrl;

            const payload = {
                name,
                sku: String(pSku || "").trim() || null,
                category: category || null,
                description: description || null,
                price_inr: price,
                stock_qty: stock,
                image_url: image_url || null,
                is_active: !!pActive,
                about_text: String(pAboutText || "").trim() || null,
                best_for: String(pBestFor || "").trim() || null,
                pairs_well_with: String(pPairsWellWith || "").trim() || null,
                recommended_stack: String(pRecommendedStack || "").trim() || null,
                highlights: pHighlights.length > 0 ? pHighlights : null,
                updated_at: new Date().toISOString(),
            };

            if (editingId) {
                const { error } = await supabase
                    .from("products")
                    .update(payload)
                    .eq("id", editingId);
                if (error) throw new Error(error.message);
                await uploadAndSaveExtraImages(editingId);
                await saveVariants(editingId);
                setProductMsg("Updated ✅");
            } else {
                const { data: inserted, error } = await supabase
                    .from("products")
                    .insert([{ ...payload }])
                    .select("id")
                    .single();
                if (error) throw new Error(error.message);
                await uploadAndSaveExtraImages(inserted.id);
                await saveVariants(inserted.id);
                setProductMsg("Created ✅");
            }

            await loadProducts();
            setPFile(null);
            setExtraImageFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (extraFileInputRef.current) extraFileInputRef.current.value = "";
        } catch (e) {
            setProductMsg(e?.message || "Failed to save product");
        } finally {
            setSavingProduct(false);
        }
    };

    const deleteProduct = async (id) => {
        const ok = window.confirm(
            "Delete this product? This will remove it from the shop."
        );
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

    // -------------------- Load orders (with profile + items + product names) --------------------
    const loadOrders = async () => {
        setLoadingOrders(true);
        setOrderErr("");

        let data = [];
        let queryError = null;

        try {
            const res = await supabase
                .from("orders")
                .select(
                    `
          id,
          user_id,
          status,
          created_at,
          total_amount_inr,
          total_inr,
          total_items,
          shipping_address,
          profiles (
            id,
            email,
            full_name
          ),
          order_items (
            product_id,
            qty,
            unit_price_inr,
            line_total_inr,
            variant_label,
            products (
              name
            )
          )
        `
                )
                .order("created_at", { ascending: false });

            data = res?.data || [];
            queryError = res?.error || null;

            if (queryError) throw new Error(queryError.message);

            // Fallback profiles fetch
            const userIds = Array.from(
                new Set((data || []).map((o) => o?.user_id).filter(Boolean))
            );

            let profileMap = {};
            if (userIds.length) {
                const profRes = await supabase
                    .from("profiles")
                    .select("id,email,full_name")
                    .in("id", userIds);

                if (!profRes?.error) {
                    (profRes?.data || []).forEach((p) => {
                        profileMap[p.id] = {
                            email: String(p?.email || "").trim(),
                            full_name: String(p?.full_name || "").trim(),
                        };
                    });
                }
            }

            const enriched = (data || []).map((o) => {
                const prof = Array.isArray(o?.profiles) ? o.profiles[0] : o?.profiles;

                const joinEmail = String(prof?.email || "").trim();
                const joinName = String(prof?.full_name || "").trim();

                const fallback = profileMap?.[o?.user_id] || null;
                const fallbackEmail = String(fallback?.email || "").trim();
                const fallbackName = String(fallback?.full_name || "").trim();

                const ship = o?.shipping_address || {};
                const shipEmail = String(
                    ship?.email || ship?.Email || ship?.userEmail || ship?.user_email || ""
                ).trim();

                const profileEmail = joinEmail || fallbackEmail || shipEmail || "";
                const profileName = joinName || fallbackName || "";

                const shipping_name = String(ship?.fullName || ship?.name || "").trim();
                const shipping_phone = String(ship?.phone || ship?.mobile || "").trim();
                const shipping_address_1 = String(ship?.line1 || ship?.address1 || "").trim();
                const shipping_address_2 = String(ship?.line2 || ship?.address2 || "").trim();
                const shipping_city = String(ship?.city || "").trim();
                const shipping_state = String(ship?.state || "").trim();
                const shipping_pincode = String(ship?.pincode || ship?.zip || "").trim();
                const shipping_country = String(ship?.country || "India").trim();

                const dbTotal = Number(o?.total_amount_inr ?? o?.total_inr ?? 0);
                let computed_total_inr =
                    Number.isFinite(dbTotal) && dbTotal > 0 ? dbTotal : 0;

                const items = Array.isArray(o?.order_items) ? o.order_items : [];
                const detailedItems = items.map((it) => {
                    const qtyNum = Number(it?.qty || 0);
                    const unitNum = Number(it?.unit_price_inr || 0);
                    const lineNum = Number(it?.line_total_inr ?? qtyNum * unitNum);

                    return {
                        product_id: it?.product_id,
                        product_name: it?.products?.name || "",
                        variant_label: it?.variant_label || "",
                        qty: it?.qty,
                        qty_num: Number.isFinite(qtyNum) ? qtyNum : 0,
                        unit_price_inr: it?.unit_price_inr,
                        line_total_inr: it?.line_total_inr,
                        line_total_num: Number.isFinite(lineNum) ? lineNum : 0,
                    };
                });

                if (!computed_total_inr) {
                    computed_total_inr = detailedItems.reduce(
                        (sum, it) => sum + (it.line_total_num || 0),
                        0
                    );
                }

                return {
                    ...o,
                    user_email: profileEmail,
                    user_full_name: profileName,
                    shipping_name: shipping_name || profileName || "",
                    shipping_email: profileEmail || "",
                    shipping_phone,
                    shipping_address_1,
                    shipping_address_2,
                    shipping_city,
                    shipping_state,
                    shipping_pincode,
                    shipping_country,
                    computed_total_inr,
                    order_items_detailed: detailedItems,
                };
            });

            setOrders(enriched);
        } catch (e) {
            setOrderErr(e?.message || "Failed to load orders");
            setOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    // Reload orders whenever Orders tab is opened; also load on mount for stats
    useEffect(() => {
        loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeTab === "orders") {
            loadOrders();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // -------------------- Update order status --------------------
    const STATUS_OPTIONS = ["placed", "processing", "shipped", "delivered", "cancelled"];

    const STATUS_LABELS = {
        placed: "Placed",
        processing: "Processing",
        shipped: "Shipped",
        delivered: "Delivered",
        cancelled: "Cancelled",
    };

    const STATUS_BADGE = {
        placed: "bg-green-50 text-green-700",
        processing: "bg-yellow-50 text-yellow-700",
        shipped: "bg-blue-50 text-blue-700",
        delivered: "bg-emerald-50 text-emerald-700",
        cancelled: "bg-red-50 text-red-700",
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        const order = orders.find((o) => o.id === orderId);
        const currentStatus = String(order?.status || "").toLowerCase();
        if (currentStatus === newStatus) return;

        const ok = window.confirm(
            `Change order status from "${STATUS_LABELS[currentStatus] || currentStatus}" → "${STATUS_LABELS[newStatus] || newStatus}"?`
        );
        if (!ok) return;

        const { error } = await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", orderId);
        if (error) {
            alert(error.message);
            return;
        }
        loadOrders();
    };

    const LOW_STOCK_THRESHOLD = 5;

    // -------------------- Inline stock update --------------------
    const saveInlineStock = async (productId) => {
        const qty = Number(inlineStockValue);
        if (!Number.isFinite(qty) || qty < 0) return;
        setSavingInlineStock(true);
        const { error } = await supabase
            .from("products")
            .update({ stock_qty: qty, updated_at: new Date().toISOString() })
            .eq("id", productId);
        setSavingInlineStock(false);
        if (error) { alert(error.message); return; }
        setInlineStockId(null);
        setInlineStockValue("");
        loadProducts();
    };

    // -------------------- Filtered products --------------------
    const filteredProducts = useMemo(() => {
        const q = String(productSearch || "").trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) =>
            String(p.name || "").toLowerCase().includes(q) ||
            String(p.category || "").toLowerCase().includes(q)
        );
    }, [products, productSearch]);

    // -------------------- Derived stats --------------------
    const stats = useMemo(() => {
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((s, o) => s + Number(o.computed_total_inr || 0), 0);
        const activeProducts = products.filter((p) => p.is_active).length;
        const lowStock = products.filter(
            (p) => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD
        ).length;
        const pendingOrders = orders.filter(
            (o) => ["placed", "processing"].includes(String(o.status || "").toLowerCase())
        ).length;
        return { totalOrders, totalRevenue, activeProducts, lowStock, pendingOrders };
    }, [orders, products]);
    const filteredOrders = useMemo(() => {
        let list = orders || [];

        const q = String(orderSearch || "").trim().toLowerCase();
        if (q) {
            list = list.filter((o) => {
                const idStr = String(o?.id ?? "").toLowerCase();
                const userStr = String(o?.user_id ?? "").toLowerCase();
                const emailStr = String(o?.user_email ?? "").toLowerCase();
                const nameStr = String(o?.shipping_name ?? "").toLowerCase();
                return (
                    idStr.includes(q) ||
                    userStr.includes(q) ||
                    emailStr.includes(q) ||
                    nameStr.includes(q)
                );
            });
        }

        if (orderStatusFilter && orderStatusFilter !== "All") {
            const wanted = String(orderStatusFilter || "").trim().toLowerCase();
            list = list.filter(
                (o) => String(o?.status || "").trim().toLowerCase() === wanted
            );
        }

        const from = orderDateFrom
            ? new Date(`${orderDateFrom}T00:00:00`).getTime()
            : null;
        const to = orderDateTo
            ? new Date(`${orderDateTo}T23:59:59`).getTime()
            : null;

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

    // -------------------- Bulk selection --------------------
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState("");
    const [applyingBulk, setApplyingBulk] = useState(false);

    const toggleSelectOrder = (id) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
        }
    };

    const applyBulkStatus = async () => {
        if (!bulkStatus || selectedOrderIds.size === 0) return;
        const ok = window.confirm(
            `Set ${selectedOrderIds.size} order(s) to "${STATUS_LABELS[bulkStatus] || bulkStatus}"?`
        );
        if (!ok) return;
        setApplyingBulk(true);
        const ids = Array.from(selectedOrderIds);
        const { error } = await supabase
            .from("orders")
            .update({ status: bulkStatus })
            .in("id", ids);
        setApplyingBulk(false);
        if (error) { alert(error.message); return; }
        setSelectedOrderIds(new Set());
        setBulkStatus("");
        loadOrders();
    };

    // -------------------- CSV Export --------------------
    const exportOrdersCSV = () => {
        const rows = filteredOrders;
        if (rows.length === 0) return;

        const headers = [
            "Order ID", "Date", "Status", "Customer Name", "Customer Email",
            "Phone", "Address", "City", "State", "Pincode",
            "Items", "Total (INR)"
        ];

        const escape = (val) => {
            const s = String(val ?? "").replace(/"/g, '""');
            return `"${s}"`;
        };

        const csvRows = rows.map((o) => {
            const itemsSummary = (o.order_items_detailed || [])
                .map((it) => `${it.product_name} x${it.qty_num}`)
                .join("; ");
            const address = [o.shipping_address_1, o.shipping_address_2]
                .filter(Boolean).join(", ");

            return [
                o.id,
                o.created_at ? new Date(o.created_at).toLocaleString() : "",
                o.status || "",
                o.shipping_name || o.user_full_name || "",
                o.user_email || "",
                o.shipping_phone || "",
                address,
                o.shipping_city || "",
                o.shipping_state || "",
                o.shipping_pincode || "",
                itemsSummary,
                o.computed_total_inr ?? 0,
            ].map(escape).join(",");
        });

        const csv = [headers.map(escape).join(","), ...csvRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `coreatoms-orders-${dateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="card p-6">
                <div className="text-xs text-stone-400">Admin</div>
                <div className="mt-1 text-2xl font-semibold text-stone-900">
                    Dashboard
                </div>
                <div className="mt-2 text-sm text-stone-500">
                    Logged in as{" "}
                    <span className="font-semibold">{profile?.email}</span> • role:{" "}
                    <span className="font-semibold">{profile?.role}</span>
                </div>

                {/* Stats Row */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
                        <div className="text-xs text-stone-400">Total Orders</div>
                        <div className="mt-1 text-2xl font-semibold text-stone-900">{stats.totalOrders}</div>
                    </div>
                    <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
                        <div className="text-xs text-stone-400">Total Revenue</div>
                        <div className="mt-1 text-2xl font-semibold text-stone-900">
                            ₹{stats.totalRevenue.toLocaleString("en-IN")}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
                        <div className="text-xs text-stone-400">Active Products</div>
                        <div className="mt-1 text-2xl font-semibold text-stone-900">{stats.activeProducts}</div>
                    </div>
                    <div className={[
                        "rounded-2xl border p-4 shadow-sm",
                        stats.lowStock > 0
                            ? "border-amber-200 bg-amber-50"
                            : "border-[#E8E4DE] bg-white",
                    ].join(" ")}>
                        <div className={stats.lowStock > 0 ? "text-xs text-amber-600" : "text-xs text-stone-400"}>
                            Low Stock {stats.lowStock > 0 ? "⚠️" : ""}
                        </div>
                        <div className={[
                            "mt-1 text-2xl font-semibold",
                            stats.lowStock > 0 ? "text-amber-700" : "text-stone-900",
                        ].join(" ")}>
                            {stats.lowStock}
                        </div>
                        {stats.lowStock > 0 && (
                            <div className="mt-1 text-xs text-amber-600">≤{LOW_STOCK_THRESHOLD} units</div>
                        )}
                    </div>
                    <div className={[
                        "rounded-2xl border p-4 shadow-sm",
                        stats.pendingOrders > 0
                            ? "border-blue-200 bg-blue-50"
                            : "border-[#E8E4DE] bg-white",
                    ].join(" ")}>
                        <div className={stats.pendingOrders > 0 ? "text-xs text-blue-600" : "text-xs text-stone-400"}>
                            Pending Orders {stats.pendingOrders > 0 ? "🔔" : ""}
                        </div>
                        <div className={[
                            "mt-1 text-2xl font-semibold",
                            stats.pendingOrders > 0 ? "text-blue-700" : "text-stone-900",
                        ].join(" ")}>
                            {stats.pendingOrders}
                        </div>
                        {stats.pendingOrders > 0 && (
                            <div className="mt-1 text-xs text-blue-600">Need action</div>
                        )}
                    </div>
                </div>

                {/* Tab Bar (mobile friendly) */}
                <div className="mt-6 -mx-4 px-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                    <button
                        type="button"
                        onClick={() => setActiveTab("products")}
                        className={[
                            "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition",
                            activeTab === "products"
                                ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                                : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
                        ].join(" ")}
                    >
                        Products
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className={[
                            "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition flex items-center gap-2",
                            activeTab === "orders"
                                ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                                : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
                        ].join(" ")}
                    >
                        Orders
                        {stats.pendingOrders > 0 && (
                            <span className={[
                                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                                activeTab === "orders" ? "bg-white text-stone-900" : "bg-red-500 text-white",
                            ].join(" ")}>
                                {stats.pendingOrders}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("settings")}
                        className={[
                            "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition",
                            activeTab === "settings"
                                ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                                : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
                        ].join(" ")}
                    >
                        Settings
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("reviews")}
                        className={[
                            "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition flex items-center gap-2",
                            activeTab === "reviews"
                                ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                                : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
                        ].join(" ")}
                    >
                        Reviews
                        {reviews.length > 0 && (
                            <span className={["inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold", activeTab === "reviews" ? "bg-white text-stone-900" : "bg-neutral-200 text-stone-600"].join(" ")}>
                                {reviews.length}
                            </span>
                        )}
                    </button>

                    <div className="hidden md:block ml-auto text-xs text-stone-400">
                        {activeTab === "products" && `${products.length} products`}
                        {activeTab === "orders" && `${orders.length} orders`}
                        {activeTab === "settings" && "App settings"}
                    </div>
                </div>

                <div className="mt-6">
                    {/* Settings Tab */}
                    {activeTab === "settings" && (
                        <div className="max-w-2xl">
                            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                                <div className="text-base font-semibold text-stone-900">
                                    Order settings
                                </div>
                                <div className="mt-2 text-sm text-stone-500">
                                    Set the max number of total items allowed per order (dynamic).
                                </div>

                                <div className="mt-4">
                                    <div className="text-xs text-stone-400">Max items per order</div>
                                    <input
                                        type="number"
                                        value={maxItems}
                                        onChange={(e) => setMaxItems(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
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
                                    {msg && <div className="text-sm text-stone-600">{msg}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Products Tab */}
                    {activeTab === "products" && (
                        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                            <div className="text-base font-semibold text-stone-900">Products</div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-stone-900">
                                            Products
                                        </div>
                                        <div className="mt-1 text-xs text-stone-400">
                                            Create, edit, delete products. Changes reflect immediately in
                                            Shop and Product Detail.
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {stats.lowStock > 0 && (
                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                                {stats.lowStock} low stock ⚠️
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={openAddProduct}
                                            className="rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm hover:shadow"
                                        >
                                            + Add Product
                                        </button>
                                    </div>
                                </div>

                                {showProductForm && (
                                    <div className="mt-4 rounded-2xl border border-[#E8E4DE] bg-white p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-stone-900">
                                                    {editingId ? `Edit Product #${editingId}` : "Add New Product"}
                                                </div>
                                                <div className="mt-1 text-xs text-stone-400">
                                                    Upload 1 main image (jpg/png/webp).
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    resetProductForm();
                                                    setShowProductForm(false);
                                                }}
                                                className="rounded-lg border border-[#E8E4DE] px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                                            >
                                                Close
                                            </button>
                                        </div>

                                        <div className="mt-4 grid gap-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <div className="text-xs text-stone-400">Product name *</div>
                                                    <input
                                                        type="text"
                                                        value={pName}
                                                        onChange={(e) => setPName(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <div className={`text-xs flex items-center gap-1.5 ${variants.length > 0 ? "text-stone-300" : "text-stone-400"}`}>
                                                        SKU
                                                        {variants.length > 0 && (
                                                            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-600 rounded-full px-2 py-0.5">managed by variants</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={pSku}
                                                        onChange={(e) => setPSku(e.target.value)}
                                                        placeholder={variants.length > 0 ? "Set per variant ↑" : "e.g. CA-MULTI-001"}
                                                        disabled={variants.length > 0}
                                                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                                                            variants.length > 0
                                                                ? "border-stone-200 bg-stone-100 text-stone-300 cursor-not-allowed"
                                                                : "border-[#E8E4DE] bg-white text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20"
                                                        }`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <div className="text-xs text-stone-400">Category</div>
                                                    <input
                                                        type="text"
                                                        value={pCategory}
                                                        onChange={(e) => setPCategory(e.target.value)}
                                                        className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-stone-400">Product description</div>
                                                <textarea
                                                    value={pDesc}
                                                    onChange={(e) => setPDesc(e.target.value)}
                                                    rows={4}
                                                    className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                />
                                            </div>

                                            {/* Rich detail fields */}
                                            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-3">
                                                <div className="text-xs font-semibold text-stone-600">Product Detail Page — Rich Info</div>
                                                <div className="text-xs text-stone-400">These appear in the "About this product" section on the product page.</div>

                                                <div>
                                                    <div className="text-xs text-stone-400">About text</div>
                                                    <textarea
                                                        value={pAboutText}
                                                        onChange={(e) => setPAboutText(e.target.value)}
                                                        rows={3}
                                                        placeholder="Detailed product description shown on the product page…"
                                                        className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                    />
                                                </div>

                                                <div className="grid gap-3 md:grid-cols-3">
                                                    <div>
                                                        <div className="text-xs text-stone-400">Best for</div>
                                                        <input
                                                            type="text"
                                                            value={pBestFor}
                                                            onChange={(e) => setPBestFor(e.target.value)}
                                                            placeholder="e.g. Energy • Performance • Daily wellness"
                                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-stone-400">Pairs well with</div>
                                                        <input
                                                            type="text"
                                                            value={pPairsWellWith}
                                                            onChange={(e) => setPPairsWellWith(e.target.value)}
                                                            placeholder="e.g. Protein • Omega-3 • Electrolytes"
                                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-stone-400">Recommended stack</div>
                                                        <input
                                                            type="text"
                                                            value={pRecommendedStack}
                                                            onChange={(e) => setPRecommendedStack(e.target.value)}
                                                            placeholder="e.g. AM: Multi • PM: Collagen"
                                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Product Card Highlights */}
                                            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-3">
                                                <div>
                                                    <div className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                                                        <svg className="h-3.5 w-3.5 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                                                        Product Card Highlights
                                                    </div>
                                                    <div className="text-[11px] text-stone-400 mt-0.5">
                                                        These small tags appear on the product card (Shop &amp; Home). If empty, defaults to: Clean label · Lab-tested · COD available.
                                                    </div>
                                                </div>

                                                {/* Tag chips */}
                                                {pHighlights.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {pHighlights.map((tag, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DE] bg-white px-3 py-1 text-[11px] font-medium text-stone-700 shadow-sm">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPHighlights(prev => prev.filter((_, j) => j !== i))}
                                                                    className="text-stone-400 hover:text-red-500 transition-colors leading-none"
                                                                    title="Remove"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Add tag input */}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={pHighlightInput}
                                                        onChange={(e) => setPHighlightInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if ((e.key === "Enter" || e.key === ",") && pHighlightInput.trim()) {
                                                                e.preventDefault();
                                                                const val = pHighlightInput.trim().replace(/,$/, "");
                                                                if (val && !pHighlights.includes(val) && pHighlights.length < 6) {
                                                                    setPHighlights(prev => [...prev, val]);
                                                                }
                                                                setPHighlightInput("");
                                                            }
                                                        }}
                                                        placeholder="Type a highlight, press Enter or comma…"
                                                        className="flex-1 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] outline-none transition"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const val = pHighlightInput.trim().replace(/,$/, "");
                                                            if (val && !pHighlights.includes(val) && pHighlights.length < 6) {
                                                                setPHighlights(prev => [...prev, val]);
                                                            }
                                                            setPHighlightInput("");
                                                        }}
                                                        disabled={!pHighlightInput.trim() || pHighlights.length >= 6}
                                                        className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition"
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* Quick presets */}
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    <div className="text-[10px] text-stone-400 w-full">Quick add:</div>
                                                    {["Clean label", "Lab-tested", "COD available", "Sugar-free", "Vegan", "Gluten-free", "Non-GMO", "GMP certified", "No preservatives"].filter(t => !pHighlights.includes(t)).map(preset => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => {
                                                                if (pHighlights.length < 6) setPHighlights(prev => [...prev, preset]);
                                                            }}
                                                            className="rounded-full border border-dashed border-stone-300 bg-white px-2.5 py-0.5 text-[10px] text-stone-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition"
                                                        >
                                                            + {preset}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ══ VARIANTS ══ */}
                                            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-4">
                                                <div>
                                                    <div className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                                                        <svg className="h-3.5 w-3.5 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                                                        Product Variants (optional)
                                                    </div>
                                                    <div className="text-[11px] text-stone-400 mt-0.5">
                                                        Add size / packaging options. Each variant has its own price, stock and SKU. If variants are set, customers must pick one before adding to cart.
                                                    </div>
                                                </div>

                                                {/* Existing variant rows */}
                                                {variants.length > 0 && (
                                                    <div className="space-y-2">
                                                        {/* Header */}
                                                        <div className="hidden sm:grid grid-cols-[1fr_100px_80px_90px_32px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400 px-1">
                                                            <span>Label</span><span>Price (₹)</span><span>Stock</span><span>SKU</span><span />
                                                        </div>
                                                        {variants.map((v, i) => (
                                                            <div key={v.id || i} className="grid grid-cols-[1fr_100px_80px_90px_32px] gap-2 items-center bg-white rounded-xl border border-[#E8E4DE] px-3 py-2.5">
                                                                {/* Label */}
                                                                <input
                                                                    value={v.label || ""}
                                                                    onChange={(e) => setVariants(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                                                                    placeholder="e.g. 60 Capsules"
                                                                    className="w-full rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1.5 text-sm text-stone-900 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                                                                />
                                                                {/* Price */}
                                                                <input
                                                                    type="number"
                                                                    value={v.price_inr ?? ""}
                                                                    onChange={(e) => setVariants(prev => prev.map((x, j) => j === i ? { ...x, price_inr: e.target.value } : x))}
                                                                    placeholder="Price"
                                                                    min={0}
                                                                    className="w-full rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1.5 text-sm text-stone-900 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                                                                />
                                                                {/* Stock */}
                                                                <input
                                                                    type="number"
                                                                    value={v.stock_qty ?? ""}
                                                                    onChange={(e) => setVariants(prev => prev.map((x, j) => j === i ? { ...x, stock_qty: e.target.value } : x))}
                                                                    placeholder="Qty"
                                                                    min={0}
                                                                    className="w-full rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1.5 text-sm text-stone-900 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                                                                />
                                                                {/* SKU */}
                                                                <input
                                                                    value={v.sku || ""}
                                                                    onChange={(e) => setVariants(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                                                                    placeholder="SKU"
                                                                    className="w-full rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1.5 text-sm text-stone-900 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                                                                />
                                                                {/* Delete */}
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (v.id) {
                                                                            if (!window.confirm("Remove this variant? Customers will no longer see it.")) return;
                                                                            await supabase.from("product_variants").delete().eq("id", v.id);
                                                                        }
                                                                        setVariants(prev => prev.filter((_, j) => j !== i));
                                                                    }}
                                                                    className="h-7 w-7 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition"
                                                                    title="Remove variant"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Add variant button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setVariants(prev => [
                                                        ...prev,
                                                        { label: "", price_inr: "", stock_qty: "", sku: "", sort_order: prev.length, is_active: true }
                                                    ])}
                                                    className="flex items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition w-full justify-center"
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                                                    Add variant
                                                </button>

                                                {variantErr && (
                                                    <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{variantErr}</div>
                                                )}

                                                {variants.length > 0 && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400 bg-white border border-[#E8E4DE] rounded-xl px-3 py-2">
                                                        <svg className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                                                        Variants are saved when you click <strong className="text-stone-600 ml-1">Save product</strong>. The base product price/stock is used as fallback if no variant is selected.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Price / Stock — disabled when variants handle pricing */}
                                            <div className="grid gap-3 md:grid-cols-3">
                                                <div>
                                                    <div className={`text-xs flex items-center gap-1.5 ${variants.length > 0 ? "text-stone-300" : "text-stone-400"}`}>
                                                        Price (₹) *
                                                        {variants.length > 0 && (
                                                            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-600 rounded-full px-2 py-0.5">managed by variants</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={pPrice}
                                                        onChange={(e) => setPPrice(e.target.value)}
                                                        disabled={variants.length > 0}
                                                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                                                            variants.length > 0
                                                                ? "border-stone-200 bg-stone-100 text-stone-300 cursor-not-allowed"
                                                                : "border-[#E8E4DE] bg-white text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20"
                                                        }`}
                                                        min={0}
                                                        placeholder={variants.length > 0 ? "Set per variant ↑" : ""}
                                                    />
                                                </div>

                                                <div>
                                                    <div className={`text-xs flex items-center gap-1.5 ${variants.length > 0 ? "text-stone-300" : "text-stone-400"}`}>
                                                        Stock qty *
                                                        {variants.length > 0 && (
                                                            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-600 rounded-full px-2 py-0.5">managed by variants</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={pStock}
                                                        onChange={(e) => setPStock(e.target.value)}
                                                        disabled={variants.length > 0}
                                                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors ${
                                                            variants.length > 0
                                                                ? "border-stone-200 bg-stone-100 text-stone-300 cursor-not-allowed"
                                                                : "border-[#E8E4DE] bg-white text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20"
                                                        }`}
                                                        min={0}
                                                        placeholder={variants.length > 0 ? "Set per variant ↑" : ""}
                                                    />
                                                </div>

                                                <div className="flex items-end gap-3">
                                                    <label className="flex items-center gap-2 text-sm text-stone-700 select-none">
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
                                                    <div className="text-xs text-stone-400">Product image</div>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                        const f = e.target.files?.[0] || null;
                                                        setPFile(f);
                                                        if (f) setPImagePreview(URL.createObjectURL(f));
                                                    }}
                                                        className="mt-1 w-full text-sm"
                                                    />
                                                    {pImagePreview && (
                                                        <div className="mt-3 flex items-center gap-3">
                                                            <img
                                                                src={pImagePreview}
                                                                alt="Preview"
                                                                className="h-20 w-20 rounded-xl border border-[#E8E4DE] object-cover shadow-sm"
                                                            />
                                                            <div className="text-xs text-stone-400">
                                                                {pFile ? "New image selected" : "Current image"}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {!pImagePreview && pImageUrl && (
                                                        <div className="mt-2 text-xs text-stone-400">
                                                            Current image:
                                                            <a
                                                                href={pImageUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="ml-1 text-stone-900 hover:underline"
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
                                                        className="w-full rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-2.5 text-sm font-semibold text-stone-900 shadow-sm hover:shadow disabled:opacity-60"
                                                    >
                                                        {savingProduct
                                                            ? "Saving..."
                                                            : editingId
                                                                ? "Save Changes"
                                                                : "Create Product"}
                                                    </button>

                                                    {editingId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteProduct(editingId)}
                                                            className="rounded-xl border border-[#E8E4DE] px-4 py-2.5 text-sm hover:bg-stone-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                                {productMsg && (
                                                <div className="text-sm text-stone-600">{productMsg}</div>
                                            )}

                                            {/* ── Extra Images Gallery ── */}
                                            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-semibold text-stone-600">Additional Images</div>
                                                        <div className="text-xs text-stone-400 mt-0.5">
                                                            These appear in the product gallery alongside the main image.
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => extraFileInputRef.current?.click()}
                                                        className="shrink-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50 shadow-sm"
                                                    >
                                                        + Add Image
                                                    </button>
                                                </div>

                                                <input
                                                    ref={extraFileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files || []);
                                                        if (!files.length) return;
                                                        setExtraImageFiles((prev) => [...prev, ...files]);
                                                        if (extraFileInputRef.current) extraFileInputRef.current.value = "";
                                                    }}
                                                />

                                                {/* Pending uploads (not yet saved) */}
                                                {extraImageFiles.length > 0 && (
                                                    <div>
                                                        <div className="text-[11px] text-amber-600 font-semibold mb-2">
                                                            {extraImageFiles.length} pending — will upload on Save
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {extraImageFiles.map((f, i) => (
                                                                <div key={i} className="relative group">
                                                                    <img
                                                                        src={URL.createObjectURL(f)}
                                                                        alt=""
                                                                        className="h-16 w-16 rounded-xl border-2 border-amber-300 object-cover"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExtraImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Saved extra images */}
                                                {extraImages.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {extraImages.map((img, i) => (
                                                            <div key={img.id} className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white p-2">
                                                                <img
                                                                    src={img.image_url}
                                                                    alt=""
                                                                    className="h-12 w-12 rounded-lg object-cover border border-[#E8E4DE] shrink-0"
                                                                />
                                                                <div className="text-xs text-stone-400 flex-1 truncate">
                                                                    Image {i + 1}
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveExtraImage(img.id, "up")}
                                                                        disabled={i === 0}
                                                                        className="h-7 w-7 rounded-lg border border-[#E8E4DE] text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                                                                        title="Move up"
                                                                    >
                                                                        ↑
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveExtraImage(img.id, "down")}
                                                                        disabled={i === extraImages.length - 1}
                                                                        className="h-7 w-7 rounded-lg border border-[#E8E4DE] text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-30"
                                                                        title="Move down"
                                                                    >
                                                                        ↓
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteExtraImage(img.id)}
                                                                        className="h-7 w-7 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50"
                                                                        title="Delete"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : extraImageFiles.length === 0 && (
                                                    <div className="text-xs text-stone-400 text-center py-3">
                                                        No additional images yet. Click "+ Add Image" to upload.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Product search */}
                                <div className="mt-4 flex items-center gap-3">
                                    <input
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="Search by name or category…"
                                        className="w-full sm:w-72 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                    />
                                    {productSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setProductSearch("")}
                                            className="text-xs text-stone-400 hover:text-stone-900"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <div className="ml-auto text-xs text-stone-400">
                                        {filteredProducts.length} of {products.length} products
                                    </div>
                                </div>

                                {/* List */}
                                <div className="mt-4">
                                    {loadingProducts ? (
                                        <div className="text-sm text-stone-400">Loading products...</div>
                                    ) : productErr ? (
                                        <div className="text-sm text-red-600">{productErr}</div>
                                    ) : products.length === 0 ? (
                                        <div className="text-sm text-stone-400">No products yet.</div>
                                    ) : (
                                        <div className="mt-2">
                                            {/* Mobile cards */}
                                            <div className="grid gap-3 md:hidden">
                                                {filteredProducts.map((p) => {
                                                    const out = Number(p.stock_qty || 0) <= 0;
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            className="rounded-2xl border border-[#E8E4DE] bg-white p-4"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className="h-14 w-14 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                                                                    {p.image_url ? (
                                                                        <img
                                                                            src={p.image_url}
                                                                            alt={p.name}
                                                                            className="h-full w-full object-cover"
                                                                            loading="lazy"
                                                                        />
                                                                    ) : null}
                                                                </div>

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-semibold text-stone-900 truncate">
                                                                        {p.name}
                                                                    </div>
                                                                    <div className="mt-0.5 text-xs text-stone-400 truncate">
                                                                        {p.category || "—"}
                                                                    </div>

                                                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                                        <div className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2">
                                                                            ₹{Number(p.price_inr || 0).toLocaleString("en-IN")}
                                                                        </div>
                                                                        <div className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs">
                                                                            {(() => {
                                                                                const activeVariants = (p.product_variants || []).filter(v => v.is_active !== false);
                                                                                if (activeVariants.length > 0) {
                                                                                    return (
                                                                                        <div className="space-y-1">
                                                                                            {activeVariants.map((v) => {
                                                                                                const vOut = Number(v.stock_qty || 0) <= 0;
                                                                                                const vLow = !vOut && Number(v.stock_qty || 0) <= LOW_STOCK_THRESHOLD;
                                                                                                return (
                                                                                                    <div key={v.id} className="flex items-center justify-between gap-1">
                                                                                                        <span className="text-stone-500 truncate">{v.label}</span>
                                                                                                        <span className={`font-semibold shrink-0 ${vOut ? "text-red-600" : vLow ? "text-amber-600" : "text-emerald-600"}`}>
                                                                                                            {vOut ? "0" : Number(v.stock_qty || 0)}{vLow && " ⚠️"}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return inlineStockId === p.id ? (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <input
                                                                                            type="number"
                                                                                            value={inlineStockValue}
                                                                                            onChange={(e) => setInlineStockValue(e.target.value)}
                                                                                            className="w-14 rounded-lg border border-stone-300 px-1.5 py-0.5 text-xs text-stone-900 outline-none"
                                                                                            min={0}
                                                                                            autoFocus
                                                                                        />
                                                                                        <button type="button" onClick={() => saveInlineStock(p.id)} className="text-[10px] font-semibold text-stone-900">Save</button>
                                                                                        <button type="button" onClick={() => { setInlineStockId(null); setInlineStockValue(""); }} className="text-[10px] text-stone-400">✕</button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button type="button" onClick={() => { setInlineStockId(p.id); setInlineStockValue(String(p.stock_qty || 0)); }} className={`w-full text-left font-semibold ${out ? "text-red-600" : Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD ? "text-amber-600" : "text-emerald-600"}`}>
                                                                                        {out
                                                                                            ? `Out of stock (0)`
                                                                                            : Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD
                                                                                            ? `Low stock ⚠️ (${Number(p.stock_qty || 0)})`
                                                                                            : `In stock (${Number(p.stock_qty || 0)})`} ✏️
                                                                                    </button>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-3 flex items-center justify-between gap-2">
                                                                        <div className="text-xs text-stone-400">
                                                                            Active:{" "}
                                                                            <span className="font-semibold text-stone-900">
                                        {p.is_active ? "Yes" : "No"}
                                      </span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEditProduct(p)}
                                                                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 text-[11px] text-stone-400">
                                                                Created:{" "}
                                                                {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Desktop table */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="w-full table-fixed text-sm">
                                                    <thead>
                                                    <tr className="text-left text-stone-400 border-b">
                                                        <th className="py-2 pr-4 w-[40%]">Product</th>
                                                        <th className="py-2 pr-4 w-[14%]">Price</th>
                                                        <th className="py-2 pr-4 w-[14%]">Stock</th>
                                                        <th className="py-2 pr-4 w-[10%]">Active</th>
                                                        <th className="py-2 pr-4 w-[16%]">Created</th>
                                                        <th className="py-2 w-[6%]">Action</th>
                                                    </tr>
                                                    </thead>

                                                    <tbody>
                                                    {filteredProducts.map((p) => {
                                                        const out = Number(p.stock_qty || 0) <= 0;
                                                        return (
                                                            <tr key={p.id} className="border-b align-top">
                                                                <td className="py-2 pr-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 rounded-lg bg-stone-100 overflow-hidden shrink-0">
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
                                                                            <div className="font-semibold text-stone-900">
                                                                                {p.name}
                                                                            </div>
                                                                            <div className="text-xs text-stone-400">
                                                                                {p.category || "—"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    ₹{Number(p.price_inr || 0).toLocaleString("en-IN")}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    {(() => {
                                                                        const activeVariants = (p.product_variants || []).filter(v => v.is_active !== false);
                                                                        if (activeVariants.length > 0) {
                                                                            // Has variants — show per-variant stock, no inline edit
                                                                            return (
                                                                                <div className="space-y-1">
                                                                                    {activeVariants.map((v) => {
                                                                                        const vOut = Number(v.stock_qty || 0) <= 0;
                                                                                        const vLow = !vOut && Number(v.stock_qty || 0) <= LOW_STOCK_THRESHOLD;
                                                                                        return (
                                                                                            <div key={v.id} className="flex items-center gap-1.5">
                                                                                                <span className="text-[11px] text-stone-500 truncate max-w-[80px]">{v.label}</span>
                                                                                                <span className={`text-[11px] font-semibold ${vOut ? "text-red-600" : vLow ? "text-amber-600" : "text-emerald-600"}`}>
                                                                                                    {vOut ? "0" : Number(v.stock_qty || 0)}
                                                                                                    {vLow && " ⚠️"}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    <div className="text-[10px] text-stone-400 mt-0.5">Edit to update stock</div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        // No variants — standard inline edit
                                                                        return inlineStockId === p.id ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <input
                                                                                    type="number"
                                                                                    value={inlineStockValue}
                                                                                    onChange={(e) => setInlineStockValue(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === "Enter") saveInlineStock(p.id);
                                                                                        if (e.key === "Escape") { setInlineStockId(null); setInlineStockValue(""); }
                                                                                    }}
                                                                                    className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-xs focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                                                                    min={0}
                                                                                    autoFocus
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => saveInlineStock(p.id)}
                                                                                    disabled={savingInlineStock}
                                                                                    className="rounded-lg bg-[#1e3a5f] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#162d4a] disabled:opacity-50"
                                                                                >
                                                                                    {savingInlineStock ? "…" : "Save"}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setInlineStockId(null); setInlineStockValue(""); }}
                                                                                    className="rounded-lg border border-[#E8E4DE] px-2 py-1 text-[10px] text-stone-500 hover:bg-stone-50"
                                                                                >
                                                                                    ✕
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setInlineStockId(p.id); setInlineStockValue(String(p.stock_qty || 0)); }}
                                                                                className="group flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-stone-100 transition"
                                                                                title="Click to edit stock"
                                                                            >
                                                                                <span className={out ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                                                                                    {out ? "Out of stock" : "In stock"}
                                                                                </span>
                                                                                <span className="text-xs text-stone-400">({Number(p.stock_qty || 0)})</span>
                                                                                {!out && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD && (
                                                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Low ⚠️</span>
                                                                                )}
                                                                                <span className="hidden group-hover:inline text-[10px] text-stone-400 ml-1">✏️</span>
                                                                            </button>
                                                                        );
                                                                    })()}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                    <span
                                        className={
                                            p.is_active
                                                ? "text-green-600 font-semibold"
                                                : "text-stone-400 font-semibold"
                                        }
                                    >
                                      {p.is_active ? "Yes" : "No"}
                                    </span>
                                                                </td>

                                                                <td className="py-2 pr-4 text-xs text-stone-400">
                                                                    {p.created_at
                                                                        ? new Date(p.created_at).toLocaleString()
                                                                        : "—"}
                                                                </td>

                                                                <td className="py-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEditProduct(p)}
                                                                        className="rounded-lg border border-[#E8E4DE] px-3 py-1.5 text-xs hover:bg-stone-50"
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
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Orders Tab */}
                    {activeTab === "orders" && (
                        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                            <div className="text-base font-semibold text-stone-900">Orders</div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold text-stone-900">
                                    Orders Management
                                </div>

                                {/* Filter Bar */}
                                <div className="mt-3 grid gap-3 md:grid-cols-4">
                                    <div>
                                        <div className="text-xs text-stone-400">
                                            Search (Order ID / User)
                                        </div>
                                        <input
                                            value={orderSearch}
                                            onChange={(e) => setOrderSearch(e.target.value)}
                                            placeholder="Search by order id, user id, name, or email..."
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">Status</div>
                                        <select
                                            value={orderStatusFilter}
                                            onChange={(e) => setOrderStatusFilter(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        >
                                            <option value="All">All</option>
                                            <option value="placed">Placed</option>
                                            <option value="processing">Processing</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">From</div>
                                        <input
                                            type="date"
                                            value={orderDateFrom}
                                            onChange={(e) => setOrderDateFrom(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">To</div>
                                        <input
                                            type="date"
                                            value={orderDateTo}
                                            onChange={(e) => setOrderDateTo(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-stone-400">
                                        Showing{" "}
                                        <span className="font-semibold text-stone-900">{filteredOrders.length}</span>{" "}
                                        of {orders.length}
                                        {selectedOrderIds.size > 0 && (
                                            <span className="ml-2 font-semibold text-stone-900">
                                                • {selectedOrderIds.size} selected
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Bulk status update */}
                                        {selectedOrderIds.size > 0 && (
                                            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5">
                                                <span className="text-xs font-semibold text-blue-700">
                                                    {selectedOrderIds.size} selected
                                                </span>
                                                <select
                                                    value={bulkStatus}
                                                    onChange={(e) => setBulkStatus(e.target.value)}
                                                    className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs text-stone-900 outline-none"
                                                >
                                                    <option value="">Set status…</option>
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={applyBulkStatus}
                                                    disabled={!bulkStatus || applyingBulk}
                                                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                                                >
                                                    {applyingBulk ? "Applying…" : "Apply"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedOrderIds(new Set()); setBulkStatus(""); }}
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        {/* Export CSV */}
                                        <button
                                            type="button"
                                            onClick={exportOrdersCSV}
                                            disabled={filteredOrders.length === 0}
                                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1.5"
                                        >
                                            ↓ Export CSV
                                            {filteredOrders.length > 0 && (
                                                <span className="text-stone-400">({filteredOrders.length})</span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrderSearch("");
                                                setOrderStatusFilter("All");
                                                setOrderDateFrom("");
                                                setOrderDateTo("");
                                                setSelectedOrderIds(new Set());
                                                setBulkStatus("");
                                            }}
                                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                </div>

                                {orderErr && <div className="mt-3 text-sm text-red-600">{orderErr}</div>}

                                {loadingOrders ? (
                                    <div className="mt-4 text-sm text-stone-400">Loading orders...</div>
                                ) : filteredOrders.length === 0 ? (
                                    <div className="mt-4 text-sm text-stone-400">No orders yet.</div>
                                ) : (
                                    <div className="mt-3">
                                        {/* Mobile cards */}
                                        <div className="grid gap-3 md:hidden">
                                            {filteredOrders.map((o) => {
                                                const st = String(o.status || "").trim().toLowerCase();

                                                const badge = [
                                                    "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
                                                    st === "placed" && "bg-green-50 text-green-700",
                                                    st === "processing" && "bg-yellow-50 text-yellow-700",
                                                    st === "shipped" && "bg-purple-50 text-purple-700",
                                                    st === "delivered" && "bg-green-50 text-green-700",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ");

                                                const displayName = o.user_full_name || o.shipping_name || "";
                                                const displayEmail = o.user_email || "";
                                                const customerLine =
                                                    displayName && displayEmail
                                                        ? `${displayName} (${displayEmail})`
                                                        : displayName
                                                            ? displayName
                                                            : displayEmail
                                                                ? displayEmail
                                                                : o.user_id;

                                                const isOpen = expandedOrderIds.has(o.id);

                                                return (
                                                    <div key={o.id} className={["rounded-2xl border p-4", selectedOrderIds.has(o.id) ? "border-blue-300 bg-blue-50/50" : "border-[#E8E4DE] bg-white"].join(" ")}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-2 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedOrderIds.has(o.id)}
                                                                    onChange={() => toggleSelectOrder(o.id)}
                                                                    className="mt-0.5 h-4 w-4 rounded shrink-0"
                                                                />
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold text-stone-900">#{o.id}</div>
                                                                    <div className="mt-1 text-xs text-stone-500 truncate">{customerLine}</div>
                                                                    <div className="mt-2 text-sm font-semibold text-stone-900">
                                                                        ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0 flex flex-col items-end gap-2">
                                                                <span className={badge}>{st || "—"}</span>
                                                                <div className="text-[11px] text-stone-400">
                                                                    {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                                            <select
                                                                value={st}
                                                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs"
                                                            >
                                                                <option value="placed">Placed</option>
                                                                <option value="processing">Processing</option>
                                                                <option value="shipped">Shipped</option>
                                                                <option value="delivered">Delivered</option>
                                                                <option value="cancelled">Cancelled</option>
                                                            </select>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleOrderExpanded(o.id)}
                                                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                                            >
                                                                {isOpen ? "Hide details" : "View details"}
                                                            </button>
                                                        </div>

                                                        {isOpen && (
                                                            <div className="mt-3 rounded-2xl border border-[#E8E4DE] bg-stone-50/50 p-3">
                                                                <div className="grid gap-3">
                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Customer</div>
                                                                        <div className="mt-2 text-sm text-stone-900">
                                                                            <div className="font-semibold">
                                                                                {o.shipping_name || o.user_full_name || "(No name)"}
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-stone-500">
                                                                                Email: {o.user_email || "(No email)"}
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-stone-500">
                                                                                Phone: {o.shipping_phone || "(No phone)"}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Shipping Address</div>
                                                                        <div className="mt-2 text-xs text-stone-600 leading-relaxed">
                                                                            {[
                                                                                o.shipping_address_1,
                                                                                o.shipping_address_2,
                                                                                [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
                                                                                o.shipping_pincode,
                                                                                o.shipping_country,
                                                                            ]
                                                                                .filter(Boolean)
                                                                                .map((line, idx) => (
                                                                                    <div key={idx}>{line}</div>
                                                                                ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Items</div>
                                                                        <div className="mt-2 space-y-2">
                                                                            {(o.order_items_detailed || []).length === 0 ? (
                                                                                <div className="text-xs text-stone-500">
                                                                                    No items found for this order.
                                                                                </div>
                                                                            ) : (
                                                                                (o.order_items_detailed || []).map((it, idx) => (
                                                                                    <div
                                                                                        key={it.product_id || idx}
                                                                                        className="flex items-start justify-between gap-3 text-xs"
                                                                                    >
                                                                                        <div className="min-w-0">
                                                                                            <div className="font-semibold text-stone-900 truncate">
                                                                                                {it.product_name || `Product #${it.product_id}`}
                                                                                            </div>
                                                                                            {it.variant_label && (
                                                                                                <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#EFF6FF] border border-[#1e3a5f]/15 px-2 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                                                                                                    <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                                                                                                    {it.variant_label}
                                                                                                </span>
                                                                                            )}
                                                                                            <div className="text-stone-500 mt-0.5">
                                                                                                Qty: {Number(it.qty_num || 0)}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="shrink-0 text-stone-900 font-semibold">
                                                                                            ₹{Number(it.line_total_num || 0).toLocaleString("en-IN")}
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            )}

                                                                            <div className="pt-2 mt-2 border-t border-[#E8E4DE] flex items-center justify-between text-xs">
                                                                                <div className="text-stone-500">Order Total</div>
                                                                                <div className="font-semibold text-stone-900">
                                                                                    ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full table-fixed text-sm">
                                                <thead>
                                                <tr className="text-left text-stone-400 border-b">
                                                    <th className="py-2 pr-2 w-[4%]">
                                                        <input
                                                            type="checkbox"
                                                            checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                                                            onChange={toggleSelectAll}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                    </th>
                                                    <th className="py-2 pr-4 w-[16%]">Order ID</th>
                                                    <th className="py-2 pr-4 w-[26%]">Customer</th>
                                                    <th className="py-2 pr-4 w-[11%]">Total</th>
                                                    <th className="py-2 pr-4 w-[11%]">Status</th>
                                                    <th className="py-2 pr-4 w-[16%]">Created</th>
                                                    <th className="py-2 w-[12%]">Actions</th>
                                                </tr>
                                                </thead>

                                                <tbody>
                                                {filteredOrders.map((o) => {
                                                    const st = String(o.status || "").trim().toLowerCase();

                                                    const badge = [
                                                        "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                                                        st === "placed" && "bg-green-50 text-green-700",
                                                        st === "processing" && "bg-yellow-50 text-yellow-700",
                                                        st === "shipped" && "bg-purple-50 text-purple-700",
                                                        st === "delivered" && "bg-green-50 text-green-700",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ");

                                                    const displayName = o.user_full_name || o.shipping_name || "";
                                                    const displayEmail = o.user_email || "";
                                                    const customerCell =
                                                        displayName && displayEmail
                                                            ? `${displayName} (${displayEmail})`
                                                            : displayName
                                                                ? displayName
                                                                : displayEmail
                                                                    ? displayEmail
                                                                    : o.user_id;

                                                    return (
                                                        <Fragment key={o.id}>
                                                            <tr className={["border-b align-top", selectedOrderIds.has(o.id) ? "bg-blue-50/60" : ""].join(" ")}>
                                                                <td className="py-2 pr-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedOrderIds.has(o.id)}
                                                                        onChange={() => toggleSelectOrder(o.id)}
                                                                        className="h-4 w-4 rounded"
                                                                    />
                                                                </td>
                                                                <td className="py-2 pr-4 text-xs font-semibold text-stone-900 break-all">
                                                                    #{o.id}
                                                                </td>

                                                                <td className="py-2 pr-4 text-xs text-stone-500 break-all">
                                                                    {customerCell}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    <span className={badge}>{st || "—"}</span>
                                                                </td>

                                                                <td className="py-2 pr-4 text-xs text-stone-400">
                                                                    {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                                                </td>

                                                                <td className="py-2">
                                                                    <div className="flex flex-col gap-2">
                                                                        <select
                                                                            value={st}
                                                                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                                            className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs"
                                                                        >
                                                                            <option value="placed">Placed</option>
                                                                            <option value="processing">Processing</option>
                                                                            <option value="shipped">Shipped</option>
                                                                            <option value="delivered">Delivered</option>
                                                                            <option value="cancelled">Cancelled</option>
                                                                        </select>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleOrderExpanded(o.id)}
                                                                            className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                                                        >
                                                                            {expandedOrderIds.has(o.id) ? "Hide details" : "View details"}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {expandedOrderIds.has(o.id) && (
                                                                <tr className="border-b bg-stone-50/50">
                                                                    <td colSpan={6} className="py-3 px-2">
                                                                        <div className="grid gap-4 md:grid-cols-3">
                                                                            {/* Customer */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Customer</div>
                                                                                <div className="mt-2 text-sm text-stone-900">
                                                                                    <div className="font-semibold">
                                                                                        {o.shipping_name || o.user_full_name || "(No name)"}
                                                                                    </div>
                                                                                    <div className="mt-1 text-xs text-stone-500">
                                                                                        Email: {o.user_email || "(No email)"}
                                                                                    </div>
                                                                                    <div className="mt-1 text-xs text-stone-500">
                                                                                        Phone: {o.shipping_phone || "(No phone)"}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Address */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Shipping Address</div>
                                                                                <div className="mt-2 text-sm text-stone-900">
                                                                                    <div className="text-xs text-stone-600 leading-relaxed">
                                                                                        {[
                                                                                            o.shipping_address_1,
                                                                                            o.shipping_address_2,
                                                                                            [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
                                                                                            o.shipping_pincode,
                                                                                            o.shipping_country,
                                                                                        ]
                                                                                            .filter(Boolean)
                                                                                            .map((line, idx) => (
                                                                                                <div key={idx}>{line}</div>
                                                                                            ))}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Items */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Items</div>
                                                                                <div className="mt-2 space-y-2">
                                                                                    {(o.order_items_detailed || []).length === 0 ? (
                                                                                        <div className="text-xs text-stone-500">
                                                                                            No items found for this order.
                                                                                        </div>
                                                                                    ) : (
                                                                                        (o.order_items_detailed || []).map((it, idx) => (
                                                                                            <div
                                                                                                key={it.product_id || idx}
                                                                                                className="flex items-start justify-between gap-3 text-xs"
                                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <div className="font-semibold text-stone-900 truncate">
                                                                                        {it.product_name || `Product #${it.product_id}`}
                                                                                    </div>
                                                                                    {it.variant_label && (
                                                                                        <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#EFF6FF] border border-[#1e3a5f]/15 px-2 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                                                                                            <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                                                                                            {it.variant_label}
                                                                                        </span>
                                                                                    )}
                                                                                    <div className="text-stone-500 mt-0.5">
                                                                                        Qty: {Number(it.qty_num || 0)}
                                                                                    </div>
                                                                                </div>
                                                                                                <div className="shrink-0 text-stone-900 font-semibold">
                                                                                                    ₹{Number(it.line_total_num || 0).toLocaleString("en-IN")}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))
                                                                                    )}

                                                                                    <div className="pt-2 mt-2 border-t border-[#E8E4DE] flex items-center justify-between text-xs">
                                                                                        <div className="text-stone-500">Order Total</div>
                                                                                        <div className="font-semibold text-stone-900">
                                                                                            ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Reviews Tab */}
                    {activeTab === "reviews" && (
                        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                            <div className="text-base font-semibold text-stone-900">Customer Reviews</div>
                            <div className="mt-1 text-xs text-stone-400">View and moderate customer reviews. You can delete bogus reviews but cannot modify them.</div>

                            <div className="mt-4 flex items-center gap-3">
                                <input
                                    value={reviewSearch}
                                    onChange={(e) => setReviewSearch(e.target.value)}
                                    placeholder="Search by product, customer, or review text…"
                                    className="w-full sm:w-80 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                />
                                {reviewSearch && (
                                    <button type="button" onClick={() => setReviewSearch("")} className="text-xs text-stone-400 hover:text-stone-900">Clear</button>
                                )}
                                <div className="ml-auto text-xs text-stone-400">{filteredReviews.length} of {reviews.length} reviews</div>
                                <button type="button" onClick={loadReviews} className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50">Refresh</button>
                            </div>

                            {reviewErr && <div className="mt-3 text-sm text-red-600">{reviewErr}</div>}

                            {loadingReviews ? (
                                <div className="mt-4 text-sm text-stone-400">Loading reviews…</div>
                            ) : filteredReviews.length === 0 ? (
                                <div className="mt-6 rounded-xl border border-[#E8E4DE] bg-stone-50 p-6 text-center text-sm text-stone-400">
                                    No reviews yet.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {filteredReviews.map((r) => {
                                        const stars = Number(r.rating || 0);
                                        return (
                                            <div key={r.id} className="rounded-2xl border border-[#E8E4DE] bg-white p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        {/* Stars + product */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="flex gap-0.5">
                                                                {[1,2,3,4,5].map((i) => (
                                                                    <span key={i} className={`text-sm ${i <= stars ? "text-amber-400" : "text-neutral-200"}`}>★</span>
                                                                ))}
                                                            </div>
                                                            <span className="text-xs font-semibold text-stone-600">{r.products?.name || "Unknown product"}</span>
                                                            <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Verified</span>
                                                        </div>

                                                        {/* Reviewer + date */}
                                                        <div className="mt-1 text-xs text-stone-400">
                                                            {r._profile?.full_name || "Anonymous"} • {r._profile?.email || ""} • {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                                                        </div>

                                                        {/* Title */}
                                                        {r.title && <div className="mt-2 text-sm font-semibold text-stone-900">{r.title}</div>}

                                                        {/* Body */}
                                                        {r.body && <div className="mt-1 text-sm text-stone-600 leading-relaxed">{r.body}</div>}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => deleteReview(r.id)}
                                                        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}