import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";

const LOW_STOCK_THRESHOLD = 5;
const PRODUCT_BUCKET = "product-images";

// ── Image Position / Zoom Adjuster Modal ──────────────────────────────────────
function ImagePositionAdjuster({ src, position, onSave, onClose }) {
    const containerRef = useRef(null);
    const [pos, setPos] = useState(() => {
        if (position) {
            const parts = position.split(" ");
            return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
        }
        return { x: 50, y: 50 };
    });
    const [zoom, setZoom] = useState(() => {
        // parse zoom from position string if stored e.g. "50% 30% / 1.2"
        if (position && position.includes("/")) {
            return parseFloat(position.split("/")[1]) || 1;
        }
        return 1;
    });
    const dragging = useRef(false);
    const lastMouse = useRef(null);

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            setPos((p) => ({
                x: Math.max(0, Math.min(100, p.x - (dx / rect.width) * 100)),
                y: Math.max(0, Math.min(100, p.y - (dy / rect.height) * 100)),
            }));
        };
        const onMouseUp = () => { dragging.current = false; };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    }, []);

    useEffect(() => {
        const onTouchMove = (e) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const dx = e.touches[0].clientX - lastMouse.current.x;
            const dy = e.touches[0].clientY - lastMouse.current.y;
            lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setPos((p) => ({
                x: Math.max(0, Math.min(100, p.x - (dx / rect.width) * 100)),
                y: Math.max(0, Math.min(100, p.y - (dy / rect.height) * 100)),
            }));
            e.preventDefault();
        };
        const onTouchEnd = () => { dragging.current = false; };
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
        return () => { window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onTouchEnd); };
    }, []);

    // Encode both position and zoom into a single CSS objectPosition-compatible string
    // We store as "X% Y% / ZOOM" and parse it on read — Home/Shop only uses "X% Y%"
    const posStr = `${Math.round(pos.x)}% ${Math.round(pos.y)}%`;
    const fullValue = zoom !== 1 ? `${posStr} / ${zoom.toFixed(2)}` : posStr;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DE]">
                    <div>
                        <div className="text-sm font-semibold text-stone-900">Adjust Image Position & Zoom</div>
                        <div className="text-xs text-stone-400 mt-0.5">Drag to reposition · use slider to zoom</div>
                    </div>
                    <button type="button" onClick={onClose} className="h-7 w-7 rounded-full border border-[#E8E4DE] flex items-center justify-center text-stone-400 hover:text-stone-700">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </button>
                </div>

                <div className="p-5">
                    {/* Preview — 3:4 card ratio */}
                    <div
                        ref={containerRef}
                        className="relative overflow-hidden rounded-xl border-2 border-[#1e3a5f]/30 select-none mx-auto"
                        style={{ aspectRatio: "3/4", maxHeight: "320px", cursor: "grab" }}
                        onMouseDown={(e) => { dragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; e.preventDefault(); }}
                        onTouchStart={(e) => { dragging.current = true; lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
                    >
                        <img
                            src={src}
                            alt="Position preview"
                            className="absolute pointer-events-none"
                            style={{
                                width: `${zoom * 100}%`,
                                height: `${zoom * 100}%`,
                                objectFit: "cover",
                                top: `${(1 - zoom) * pos.y}%`,
                                left: `${(1 - zoom) * pos.x}%`,
                            }}
                            draggable={false}
                        />
                        {/* Rule-of-thirds grid */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                            backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                            backgroundSize: "33.33% 33.33%",
                        }} />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-5 w-5 rounded-full border-2 border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-[10px] text-white font-medium">✦ Drag to reposition</span>
                        </div>
                    </div>

                    {/* Zoom slider */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="text-xs text-stone-500 font-medium">Zoom</div>
                            <div className="text-xs font-mono text-stone-700">{zoom.toFixed(2)}×</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-stone-400">1×</span>
                            <input type="range" min="100" max="200" step="1" value={Math.round(zoom * 100)}
                                onChange={(e) => setZoom(Number(e.target.value) / 100)}
                                className="flex-1 accent-[#1e3a5f]" />
                            <span className="text-xs text-stone-400">2×</span>
                        </div>
                    </div>

                    {/* Quick presets */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {[
                            { label: "Top",    pos: { x: 50, y: 15 } },
                            { label: "Center", pos: { x: 50, y: 50 } },
                            { label: "Bottom", pos: { x: 50, y: 85 } },
                            { label: "Left",   pos: { x: 20, y: 50 } },
                            { label: "Right",  pos: { x: 80, y: 50 } },
                        ].map(({ label, pos: p }) => (
                            <button key={label} type="button" onClick={() => setPos(p)}
                                className="rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1 text-xs text-stone-600 hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] transition">{label}</button>
                        ))}
                        <button type="button" onClick={() => { setPos({ x: 50, y: 50 }); setZoom(1); }}
                            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-500 hover:text-stone-700 transition">Reset all</button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#E8E4DE]">
                    <button type="button" onClick={onClose} className="rounded-xl border border-[#E8E4DE] px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Cancel</button>
                    <button type="button" onClick={() => { onSave(fullValue); onClose(); }}
                        className="rounded-xl bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#16304f] transition">Apply</button>
                </div>
            </div>
        </div>
    );
}

export default function AdminProducts({ onProductsChange }) {
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
    const [pImagePosition, setPImagePosition] = useState("50% 50%"); // focal point + zoom
    const [showImageAdjuster, setShowImageAdjuster] = useState(false);

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
            const p = data || []; setProducts(p); onProductsChange?.(p);
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
        setPImagePosition("50% 50%");
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
        // form close handled by parent
    };

    const openEditProduct = (p) => {
        // form close handled by parent
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
        setPImagePosition(p.image_position || "50% 50%");
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
                image_position: pImagePosition || "50% 50%",
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

    const filteredProducts = useMemo(() => {
        const q = String(productSearch || "").trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) =>
            String(p.name || "").toLowerCase().includes(q) ||
            String(p.category || "").toLowerCase().includes(q)
        );
    }, [products, productSearch]);

    const saveInlineStock = async (productId) => {
        const qty = Number(inlineStockValue);
        if (!Number.isFinite(qty) || qty < 0) return;
        setSavingInlineStock(true);
        const { error } = await supabase
            .from("products")
            .update({ stock_qty: qty })
            .eq("id", productId);
        setSavingInlineStock(false);
        if (error) { alert(error.message); return; }
        setInlineStockId(null);
        setInlineStockValue("");
        loadProducts();
    };

    return (
    <>
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
                    {products.filter(p => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD).length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                            {products.filter(p => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD).length} low stock ⚠️
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
                                    <div className="mt-3 flex items-start gap-3">
                                        <div className="relative shrink-0 h-20 w-20 rounded-xl overflow-hidden border border-[#E8E4DE] shadow-sm bg-stone-50">
                                            <img
                                                src={pImagePreview}
                                                alt="Preview"
                                                className="absolute inset-0 h-full w-full object-cover"
                                                style={{ objectPosition: pImagePosition.includes("/") ? pImagePosition.split("/")[0].trim() : pImagePosition }}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5 justify-center">
                                            <div className="text-xs text-stone-400">
                                                {pFile ? "New image selected" : "Current image"}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowImageAdjuster(true)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] transition w-fit"
                                            >
                                                <svg className="h-3 w-3 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/></svg>
                                                Adjust position & zoom
                                            </button>
                                            {pImagePosition !== "50% 50%" && (
                                                <div className="text-[10px] text-stone-400 font-mono">{pImagePosition}</div>
                                            )}
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
                                                        style={{ objectPosition: p.image_position || "50% 50%" }}
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

    {/* Image Position & Zoom Adjuster Modal */}
    {showImageAdjuster && pImagePreview && (
        <ImagePositionAdjuster
            src={pImagePreview}
            position={pImagePosition}
            onSave={(val) => setPImagePosition(val)}
            onClose={() => setShowImageAdjuster(false)}
        />
    )}
    </>
    );
}
